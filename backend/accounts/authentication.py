from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication

from .crypto import key_store


class _CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):
        # Return the failure reason instead of an HttpResponse.
        return reason


def _dummy_get_response(request):  # pragma: no cover
    return None


def enforce_csrf(request):
    """Run Django's CSRF check on a DRF request.

    DRF views are csrf_exempt by default, so cookie-based auth must check
    CSRF itself (same approach as DRF's SessionAuthentication).
    """
    check = _CSRFCheck(_dummy_get_response)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise exceptions.PermissionDenied(f'CSRF Failed: {reason}')


class CookieJWTAuthentication(JWTAuthentication):
    """Authenticate with the access token from the HTTP-only cookie.

    Falls back to the Authorization header (handy for scripts/tests).

    A session also needs the user's encryption key in memory (derived at login, lost on
    logout, idle expiry or a server restart). Without it the session counts as ended, so
    the client refreshes, is refused, and sends the user to sign in again.
    """

    def authenticate(self, request):
        result = self._authenticate(request)
        if result is not None and not key_store.has(result[0].pk):
            raise exceptions.AuthenticationFailed(
                'Please sign in again.', code='encryption_key_unavailable'
            )
        return result

    def _authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        raw_token = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        enforce_csrf(request)
        return user, validated_token
