from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import update_last_login
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from tracker.encryption import encrypt_legacy_rows

from .authentication import enforce_csrf
from .cookies import clear_auth_cookies, set_auth_cookies
from .crypto import key_store, lock, unlock
from .export import export_user_data
from .models import PolicyAcceptance
from .serializers import (
    AccountDeleteSerializer,
    AccountUpdateSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .throttles import RegisterGlobalThrottle, RegisterIPThrottle


def _refresh_token_user_id(raw):
    """User id of a valid (not expired, not blacklisted) refresh token, else None."""
    try:
        claim = RefreshToken(raw)[jwt_settings.USER_ID_CLAIM]
    except TokenError:
        return None
    return get_user_model()._meta.pk.to_python(claim)  # the claim is a string


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
        credentials = serializer.validated_data
        # Usernames are unique case-insensitively, so accept any casing (phones capitalise).
        match = (
            get_user_model()
            .objects.filter(username__iexact=credentials['username'].strip())
            .first()
        )
        user = authenticate(
            request,
            username=match.username if match else credentials['username'],
            password=credentials['password'],
        )
        if user is None:
            return Response(
                {'detail': 'Invalid username or password.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # The password is only available here: derive the encryption key from it and keep
        # it in memory for this session (accounts/crypto.py).
        unlock(user, credentials['password'])
        encrypt_legacy_rows(user)

        refresh = RefreshToken.for_user(user)
        update_last_login(None, user)

        response = Response(UserSerializer(user).data)
        return set_auth_cookies(response, str(refresh.access_token), str(refresh))


class RegisterView(APIView):
    """Create an account and log it in (sets the auth cookies).

    Abuse protection: CSRF token required, per-IP and global rate limits,
    honeypot field and Django password validators. Anonymous: only a password is
    sent; the server generates the random username and no email is stored.
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [RegisterIPThrottle, RegisterGlobalThrottle]

    def post(self, request):
        enforce_csrf(request)
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            user = serializer.save()
        unlock(user, serializer.validated_data['password'])

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

        # Without the in-memory encryption key (restart, idle expiry, logout elsewhere)
        # the session cannot continue: the user must sign in to derive it again.
        user_id = _refresh_token_user_id(raw)
        if user_id is None or not key_store.has(user_id):
            return clear_auth_cookies(
                Response({'detail': 'Session expired.'}, status=status.HTTP_401_UNAUTHORIZED)
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
            user_id = _refresh_token_user_id(raw)
            if user_id is not None:
                lock(user_id)  # forget the encryption key; sign in again to read the notes
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass  # already invalid/expired, nothing to revoke
        response = Response(status=status.HTTP_204_NO_CONTENT)
        return clear_auth_cookies(response)


class MeView(APIView):
    """The signed-in user's own account: read, remove a legacy email (PATCH), erase (DELETE)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        """Remove a legacy email from the account (sign-up no longer collects one)."""
        serializer = AccountUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.email = ''
        request.user.save(update_fields=['email'])
        return Response(UserSerializer(request.user).data)

    def delete(self, request):
        serializer = AccountDeleteSerializer(
            data=request.data, context={'user': request.user}
        )
        serializer.is_valid(raise_exception=True)
        user = request.user
        user_id = user.pk
        with transaction.atomic():
            # Token rows reference the user with SET_NULL, so remove them explicitly
            # (this also removes their blacklist entries). Everything else the user owns
            # (entries, notes, goals, courses, policy acceptances) is deleted by cascade.
            OutstandingToken.objects.filter(user=user).delete()
            user.delete()
        lock(user_id)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        return clear_auth_cookies(response)


class AcceptPrivacyView(APIView):
    """Record that the signed-in user accepted the current privacy policy version."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        PolicyAcceptance.objects.get_or_create(
            user=request.user, version=settings.PRIVACY_POLICY_VERSION
        )
        return Response(UserSerializer(request.user).data)


class ExportView(APIView):
    """Download all personal data we hold about the signed-in user as JSON."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        response = Response(export_user_data(request.user))
        response['Content-Disposition'] = 'attachment; filename="fstracker-data.json"'
        response['Cache-Control'] = 'no-store'
        return response
