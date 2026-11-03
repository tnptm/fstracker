from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .authentication import enforce_csrf
from .cookies import clear_auth_cookies, set_auth_cookies
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer
from .throttles import RegisterGlobalThrottle, RegisterIPThrottle


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfView(APIView):
    """Sets the csrftoken cookie. The frontend calls this before login."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        enforce_csrf(request)
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request, **serializer.validated_data)
        if user is None:
            return Response(
                {'detail': 'Invalid username or password.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)
        update_last_login(None, user)

        response = Response(UserSerializer(user).data)
        return set_auth_cookies(response, str(refresh.access_token), str(refresh))


class RegisterView(APIView):
    """Create an account and log it in (sets the auth cookies).

    Abuse protection: CSRF token required, per-IP and global rate limits,
    honeypot field, Django password validators, case-insensitive uniqueness.
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [RegisterIPThrottle, RegisterGlobalThrottle]

    def post(self, request):
        enforce_csrf(request)
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = serializer.save()
        except IntegrityError:  # lost a race with a concurrent sign-up
            return Response(
                {'username': ['This username is already taken.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refresh = RefreshToken.for_user(user)
        update_last_login(None, user)
        response = Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return set_auth_cookies(response, str(refresh.access_token), str(refresh))


class RefreshView(APIView):
    """Issue a new access token (and rotated refresh token) from the refresh cookie.

    Because the refresh token is rotated every time, each refresh restarts the
    30-day window: the session only ends after 30 days without use.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        enforce_csrf(request)
        raw = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if raw is None:
            return Response(
                {'detail': 'No refresh token.'}, status=status.HTTP_401_UNAUTHORIZED
            )

        serializer = TokenRefreshSerializer(data={'refresh': raw})
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, AuthenticationFailed, ObjectDoesNotExist):
            response = Response(
                {'detail': 'Session expired.'}, status=status.HTTP_401_UNAUTHORIZED
            )
            return clear_auth_cookies(response)

        data = serializer.validated_data
        response = Response(status=status.HTTP_204_NO_CONTENT)
        return set_auth_cookies(response, data['access'], data.get('refresh'))


class LogoutView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        enforce_csrf(request)
        raw = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if raw is not None:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass  # already invalid/expired, nothing to revoke
        response = Response(status=status.HTTP_204_NO_CONTENT)
        return clear_auth_cookies(response)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
