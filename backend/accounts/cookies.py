from django.conf import settings


def _common():
    return {
        'httponly': True,
        'secure': settings.AUTH_COOKIE_SECURE,
        'samesite': settings.AUTH_COOKIE_SAMESITE,
    }


def set_auth_cookies(response, access, refresh=None):
    jwt = settings.SIMPLE_JWT
    response.set_cookie(
        settings.AUTH_COOKIE_ACCESS,
        access,
        max_age=int(jwt['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        path='/',
        **_common(),
    )
    if refresh is not None:
        response.set_cookie(
            settings.AUTH_COOKIE_REFRESH,
            refresh,
            max_age=int(jwt['REFRESH_TOKEN_LIFETIME'].total_seconds()),
            path=settings.AUTH_COOKIE_REFRESH_PATH,
            **_common(),
        )
    return response


def clear_auth_cookies(response):
    response.delete_cookie(
        settings.AUTH_COOKIE_ACCESS, path='/', samesite=settings.AUTH_COOKIE_SAMESITE
    )
    response.delete_cookie(
        settings.AUTH_COOKIE_REFRESH,
        path=settings.AUTH_COOKIE_REFRESH_PATH,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    return response
