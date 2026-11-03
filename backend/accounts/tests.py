from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.settings import api_settings
from rest_framework.test import APIClient, APITestCase


class AuthFlowTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('alice', password='s3cret-pass')
        # enforce_csrf_checks makes the test client behave like a real browser.
        self.client = APIClient(enforce_csrf_checks=True)

    def csrf_headers(self):
        self.client.get('/api/auth/csrf/')
        return {'HTTP_X_CSRFTOKEN': self.client.cookies['csrftoken'].value}

    def login(self, password='s3cret-pass'):
        return self.client.post(
            '/api/auth/login/',
            {'username': 'alice', 'password': password},
            format='json',
            **self.csrf_headers(),
        )

    def test_login_sets_httponly_cookies(self):
        res = self.login()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['username'], 'alice')
        access = res.cookies[settings.AUTH_COOKIE_ACCESS]
        refresh = res.cookies[settings.AUTH_COOKIE_REFRESH]
        self.assertTrue(access['httponly'])
        self.assertTrue(refresh['httponly'])
        self.assertEqual(refresh['path'], '/')
        self.assertEqual(refresh['max-age'], 30 * 24 * 60 * 60)
        self.assertNotIn('access', res.data)

    def test_login_rejects_bad_password(self):
        res = self.login(password='wrong')
        self.assertEqual(res.status_code, 401)
        self.assertNotIn(settings.AUTH_COOKIE_ACCESS, res.cookies)

    def test_login_requires_csrf(self):
        res = self.client.post(
            '/api/auth/login/', {'username': 'alice', 'password': 's3cret-pass'}, format='json'
        )
        self.assertEqual(res.status_code, 403)

    def test_me_requires_auth(self):
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        self.login()
        res = self.client.get('/api/auth/me/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['username'], 'alice')

    def test_unsafe_request_with_cookie_requires_csrf(self):
        self.login()
        # A cookie-authenticated POST without the CSRF header must be rejected.
        res = self.client.post('/api/auth/me/')
        self.assertEqual(res.status_code, 403)

    def test_refresh_rotates_and_blacklists_old_token(self):
        self.login()
        old_refresh = self.client.cookies[settings.AUTH_COOKIE_REFRESH].value
        res = self.client.post('/api/auth/refresh/', **self.csrf_headers())
        self.assertEqual(res.status_code, 204)
        new_refresh = res.cookies[settings.AUTH_COOKIE_REFRESH].value
        self.assertNotEqual(old_refresh, new_refresh)
        self.assertEqual(
            res.cookies[settings.AUTH_COOKIE_REFRESH]['max-age'], 30 * 24 * 60 * 60
        )

        # Reusing the old refresh token fails.
        self.client.cookies[settings.AUTH_COOKIE_REFRESH] = old_refresh
        res = self.client.post('/api/auth/refresh/', **self.csrf_headers())
        self.assertEqual(res.status_code, 401)

    def test_logout_clears_cookies_and_revokes_refresh(self):
        self.login()
        refresh = self.client.cookies[settings.AUTH_COOKIE_REFRESH].value
        res = self.client.post('/api/auth/logout/', **self.csrf_headers())
        self.assertEqual(res.status_code, 204)
        self.assertEqual(res.cookies[settings.AUTH_COOKIE_ACCESS].value, '')
        self.assertEqual(res.cookies[settings.AUTH_COOKIE_REFRESH].value, '')
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

        self.client.cookies[settings.AUTH_COOKIE_REFRESH] = refresh
        res = self.client.post('/api/auth/refresh/', **self.csrf_headers())
        self.assertEqual(res.status_code, 401)


class RegisterTests(APITestCase):
    URL = '/api/auth/register/'

    def setUp(self):
        cache.clear()  # throttle counters live in the cache
        self.client = APIClient(enforce_csrf_checks=True)

    def csrf_headers(self):
        self.client.get('/api/auth/csrf/')
        return {'HTTP_X_CSRFTOKEN': self.client.cookies['csrftoken'].value}

    def payload(self, **overrides):
        data = {
            'username': 'bob',
            'email': 'Bob@Example.com',
            'password': 'violet-harbor-42',
            'password_confirm': 'violet-harbor-42',
        }
        data.update(overrides)
        return data

    def register(self, **overrides):
        return self.client.post(
            self.URL, self.payload(**overrides), format='json', **self.csrf_headers()
        )

    def test_register_creates_user_and_logs_in(self):
        res = self.register()
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['username'], 'bob')
        self.assertEqual(res.data['email'], 'bob@example.com')
        self.assertNotIn('password', res.data)
        self.assertTrue(res.cookies[settings.AUTH_COOKIE_ACCESS]['httponly'])
        self.assertTrue(res.cookies[settings.AUTH_COOKIE_REFRESH]['httponly'])
        user = get_user_model().objects.get(username='bob')
        self.assertTrue(user.check_password('violet-harbor-42'))
        self.assertFalse(user.is_staff or user.is_superuser)
        self.assertEqual(self.client.get('/api/auth/me/').data['username'], 'bob')

    def test_register_requires_csrf(self):
        res = self.client.post(self.URL, self.payload(), format='json')
        self.assertEqual(res.status_code, 403)
        self.assertFalse(get_user_model().objects.exists())

    def test_cannot_set_privileged_fields(self):
        res = self.register(is_staff=True, is_superuser=True)
        self.assertEqual(res.status_code, 201)
        user = get_user_model().objects.get(username='bob')
        self.assertFalse(user.is_staff or user.is_superuser)

    def test_honeypot_rejects(self):
        res = self.register(website='http://spam.example')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(get_user_model().objects.exists())

    def test_password_mismatch(self):
        res = self.register(password_confirm='something-else-42')
        self.assertEqual(res.status_code, 400)
        self.assertIn('password_confirm', res.data)

    def test_weak_password_rejected(self):
        for pw in ['short', '12345678901', 'password123']:
            res = self.register(password=pw, password_confirm=pw)
            self.assertEqual(res.status_code, 400, pw)
            self.assertIn('password', res.data)
        # Too similar to the username.
        res = self.register(
            username='violetharbor', password='violetharbor1', password_confirm='violetharbor1'
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('password', res.data)

    def test_duplicate_username_and_email_case_insensitive(self):
        get_user_model().objects.create_user('Bob', 'bob@example.com', 'x-pass-12345')
        res = self.register(username='BOB', email='other@example.com')
        self.assertEqual(res.status_code, 400)
        self.assertIn('username', res.data)
        res = self.register(username='robert', email='BOB@example.COM')
        self.assertEqual(res.status_code, 400)
        self.assertIn('email', res.data)

    def test_invalid_username_chars(self):
        res = self.register(username='bob<script>')
        self.assertEqual(res.status_code, 400)
        self.assertIn('username', res.data)

    def test_rate_limited_per_ip(self):
        rate = api_settings.DEFAULT_THROTTLE_RATES['register']
        limit = int(rate.split('/')[0])
        for i in range(limit):
            res = self.register(username=f'user{i}', email=f'u{i}@example.com')
            self.assertEqual(res.status_code, 201)
            self.client.post('/api/auth/logout/', **self.csrf_headers())
        res = self.register(username='onemore', email='more@example.com')
        self.assertEqual(res.status_code, 429)
        self.assertFalse(get_user_model().objects.filter(username='onemore').exists())

    def test_spoofed_forwarded_for_does_not_bypass_limit(self):
        limit = int(api_settings.DEFAULT_THROTTLE_RATES['register'].split('/')[0])
        for i in range(limit + 1):
            res = self.client.post(
                self.URL,
                self.payload(username=f'spoof{i}', email=f's{i}@example.com'),
                format='json',
                HTTP_X_FORWARDED_FOR=f'10.0.0.{i}',
                **self.csrf_headers(),
            )
        self.assertEqual(res.status_code, 429)
