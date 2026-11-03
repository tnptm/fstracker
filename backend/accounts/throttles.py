from rest_framework.throttling import SimpleRateThrottle


class RegisterIPThrottle(SimpleRateThrottle):
    """Limit sign-ups per client IP (rate: DEFAULT_THROTTLE_RATES['register'])."""

    scope = 'register'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class RegisterGlobalThrottle(SimpleRateThrottle):
    """Site-wide cap on sign-ups, a backstop against distributed bots or
    spoofed client IPs (rate: DEFAULT_THROTTLE_RATES['register_global'])."""

    scope = 'register_global'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': 'all'}
