from io import StringIO

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.settings import api_settings
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from accounts.models import PolicyAcceptance
from tracker.models import DailyComment, MonthlyCourses, MonthlyHourGoal, Tracker


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
            'password': 'violet-harbor-42',
            'password_confirm': 'violet-harbor-42',
            'accept_privacy': True,
        }
        data.update(overrides)
        return data

    def register(self, **overrides):
        return self.client.post(
            self.URL, self.payload(**overrides), format='json', **self.csrf_headers()
        )

    def test_register_creates_anonymous_user_and_logs_in(self):
        res = self.register()
        self.assertEqual(res.status_code, 201)
        username = res.data['username']
        self.assertRegex(username, r'^[a-z2-9]{12}$')
        self.assertEqual(res.data['email'], '')
        self.assertNotIn('password', res.data)
        self.assertTrue(res.cookies[settings.AUTH_COOKIE_ACCESS]['httponly'])
        self.assertTrue(res.cookies[settings.AUTH_COOKIE_REFRESH]['httponly'])
        user = get_user_model().objects.get(username=username)
        self.assertTrue(user.check_password('violet-harbor-42'))
        self.assertEqual((user.email, user.first_name, user.last_name), ('', '', ''))
        self.assertFalse(user.is_staff or user.is_superuser)
        self.assertEqual(self.client.get('/api/auth/me/').data['username'], username)

    def test_usernames_are_random(self):
        names = set()
        for _ in range(3):
            names.add(self.register().data['username'])
            self.client.post('/api/auth/logout/', **self.csrf_headers())
        self.assertEqual(len(names), 3)

    def test_client_cannot_choose_username_or_email(self):
        res = self.register(username='chosen', email='me@example.com', first_name='Bob')
        self.assertEqual(res.status_code, 201)
        user = get_user_model().objects.get()
        self.assertNotEqual(user.username, 'chosen')
        self.assertEqual((user.email, user.first_name), ('', ''))

    def test_register_requires_privacy_acceptance(self):
        for value in (False, None):
            res = self.register(accept_privacy=value)
            self.assertEqual(res.status_code, 400)
            self.assertIn('accept_privacy', res.data)
        payload = self.payload()
        del payload['accept_privacy']
        res = self.client.post(self.URL, payload, format='json', **self.csrf_headers())
        self.assertEqual(res.status_code, 400)
        self.assertIn('accept_privacy', res.data)
        self.assertFalse(get_user_model().objects.exists())

    def test_register_records_policy_acceptance(self):
        res = self.register()
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data['privacy_accepted'])
        acceptance = PolicyAcceptance.objects.get(user__username=res.data['username'])
        self.assertEqual(acceptance.version, settings.PRIVACY_POLICY_VERSION)

    def test_register_requires_csrf(self):
        res = self.client.post(self.URL, self.payload(), format='json')
        self.assertEqual(res.status_code, 403)
        self.assertFalse(get_user_model().objects.exists())

    def test_cannot_set_privileged_fields(self):
        res = self.register(is_staff=True, is_superuser=True)
        self.assertEqual(res.status_code, 201)
        user = get_user_model().objects.get()
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

    def test_login_ignores_username_case_and_spaces(self):
        username = self.register().data['username']
        self.client.post('/api/auth/logout/', **self.csrf_headers())
        res = self.client.post(
            '/api/auth/login/',
            {'username': f' {username.upper()} ', 'password': 'violet-harbor-42'},
            format='json',
            **self.csrf_headers(),
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['username'], username)

    def test_rate_limited_per_ip(self):
        rate = api_settings.DEFAULT_THROTTLE_RATES['register']
        limit = int(rate.split('/')[0])
        for _ in range(limit):
            self.assertEqual(self.register().status_code, 201)
            self.client.post('/api/auth/logout/', **self.csrf_headers())
        res = self.register()
        self.assertEqual(res.status_code, 429)
        self.assertEqual(get_user_model().objects.count(), limit)

    def test_spoofed_forwarded_for_does_not_bypass_limit(self):
        limit = int(api_settings.DEFAULT_THROTTLE_RATES['register'].split('/')[0])
        for i in range(limit + 1):
            res = self.client.post(
                self.URL,
                self.payload(),
                format='json',
                HTTP_X_FORWARDED_FOR=f'10.0.0.{i}',
                **self.csrf_headers(),
            )
        self.assertEqual(res.status_code, 429)


class AccountRightsTests(APITestCase):
    """GDPR rights: access/portability (export), legacy email removal, erasure, acceptance."""

    PASSWORD = 'violet-harbor-42'

    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user('alice', 'alice@example.com', self.PASSWORD)
        self.other = get_user_model().objects.create_user('carol', 'carol@example.com', self.PASSWORD)
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.get('/api/auth/csrf/')
        self.csrf = {'HTTP_X_CSRFTOKEN': self.client.cookies['csrftoken'].value}
        res = self.client.post(
            '/api/auth/login/',
            {'username': 'alice', 'password': self.PASSWORD},
            format='json',
            **self.csrf,
        )
        self.assertEqual(res.status_code, 200)

    def add_data(self, user):
        now = timezone.now()
        Tracker.objects.create(
            user=user, start_time=now - timezone.timedelta(hours=2),
            end_time=now - timezone.timedelta(hours=1), description='Helped at the food bank',
        )
        DailyComment.objects.create(user=user, date=now.date(), kind='sick', comment='Flu')
        MonthlyHourGoal.objects.create(user=user, month=now.date().replace(day=1), hour_goal=20)
        MonthlyCourses.objects.create(user=user, month=now.date().replace(day=1), course_number=2)

    def test_export_requires_auth(self):
        res = APIClient().get('/api/auth/me/export/')
        self.assertEqual(res.status_code, 401)

    def test_export_contains_only_own_data(self):
        self.add_data(self.user)
        self.add_data(self.other)
        PolicyAcceptance.objects.create(user=self.user, version=settings.PRIVACY_POLICY_VERSION)
        res = self.client.get('/api/auth/me/export/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('attachment', res['Content-Disposition'])
        data = res.json()
        self.assertEqual(data['account']['username'], 'alice')
        self.assertEqual(data['account']['email'], 'alice@example.com')
        self.assertNotIn('password', data['account'])
        self.assertEqual(len(data['time_entries']), 1)
        self.assertEqual(data['time_entries'][0]['description'], 'Helped at the food bank')
        self.assertEqual(data['daily_comments'][0]['comment'], 'Flu')
        self.assertEqual(data['monthly_hour_goals'][0]['hour_goal'], 20)
        self.assertEqual(data['monthly_courses'][0]['course_number'], 2)
        self.assertEqual(len(data['privacy_policy_acceptances']), 1)
        self.assertNotIn('carol', res.content.decode())

    def test_remove_legacy_email(self):
        res = self.client.patch('/api/auth/me/', {'email': ''}, format='json', **self.csrf)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['email'], '')
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, '')

    def test_patch_cannot_set_email_or_other_fields(self):
        for body in ({'email': 'new@example.com'}, {'username': 'x'}, {'is_staff': True}):
            res = self.client.patch('/api/auth/me/', body, format='json', **self.csrf)
            self.assertEqual(res.status_code, 400, body)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'alice@example.com')
        self.assertEqual(self.user.username, 'alice')
        self.assertFalse(self.user.is_staff)

    def test_patch_requires_csrf(self):
        res = self.client.patch('/api/auth/me/', {'email': ''}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_delete_account_requires_password(self):
        res = self.client.delete('/api/auth/me/', {'password': 'wrong'}, format='json', **self.csrf)
        self.assertEqual(res.status_code, 400)
        self.assertTrue(get_user_model().objects.filter(username='alice').exists())

    def test_delete_account_erases_everything(self):
        self.add_data(self.user)
        self.add_data(self.other)
        PolicyAcceptance.objects.create(user=self.user, version='x')
        res = self.client.delete(
            '/api/auth/me/', {'password': self.PASSWORD}, format='json', **self.csrf
        )
        self.assertEqual(res.status_code, 204)
        self.assertEqual(res.cookies[settings.AUTH_COOKIE_ACCESS].value, '')
        self.assertEqual(res.cookies[settings.AUTH_COOKIE_REFRESH].value, '')
        self.assertFalse(get_user_model().objects.filter(username='alice').exists())
        self.assertFalse(Tracker.objects.filter(description='Helped at the food bank').exclude(user=self.other).exists())
        self.assertEqual(Tracker.objects.count(), 1)
        self.assertEqual(DailyComment.objects.count(), 1)
        self.assertEqual(MonthlyHourGoal.objects.count(), 1)
        self.assertEqual(MonthlyCourses.objects.count(), 1)
        self.assertEqual(PolicyAcceptance.objects.count(), 0)
        self.assertFalse(OutstandingToken.objects.filter(user=None).exists())
        # The deleted user's cookies no longer work.
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        # Other users are untouched.
        self.assertTrue(get_user_model().objects.filter(username='carol').exists())

    def test_accept_privacy_for_existing_user(self):
        me = self.client.get('/api/auth/me/')
        self.assertFalse(me.data['privacy_accepted'])
        res = self.client.post('/api/auth/privacy/accept/', **self.csrf)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['privacy_accepted'])
        # Idempotent.
        self.client.post('/api/auth/privacy/accept/', **self.csrf)
        self.assertEqual(PolicyAcceptance.objects.filter(user=self.user).count(), 1)


class RetentionTests(APITestCase):
    def make_user(self, name, last_seen, **extra):
        user = get_user_model().objects.create_user(name, f'{name}@example.com', 'x-pass-12345', **extra)
        get_user_model().objects.filter(pk=user.pk).update(last_login=last_seen, date_joined=last_seen)
        return user

    def run_command(self, *args):
        call_command('enforce_retention', *args, verbosity=0, stdout=StringIO())

    def test_deletes_only_inactive_non_staff_accounts(self):
        now = timezone.now()
        old = now - timezone.timedelta(days=3 * 365)
        stale = self.make_user('stale', old)
        Tracker.objects.create(
            user=stale, start_time=old, end_time=old + timezone.timedelta(hours=1)
        )
        fresh = self.make_user('fresh', now - timezone.timedelta(days=30))
        admin = self.make_user('boss', old, is_staff=True)
        # Old password login, but the session was refreshed recently.
        refreshing = self.make_user('refreshing', old)
        OutstandingToken.objects.create(
            user=refreshing, jti='abc', token='t', created_at=now, expires_at=now + timezone.timedelta(days=30)
        )

        self.run_command('--months', '24')
        names = set(get_user_model().objects.values_list('username', flat=True))
        self.assertEqual(names, {'fresh', 'boss', 'refreshing'})
        self.assertEqual(Tracker.objects.count(), 0)
        self.assertTrue(get_user_model().objects.filter(pk=fresh.pk).exists())
        self.assertTrue(get_user_model().objects.filter(pk=admin.pk).exists())

    def test_dry_run_and_disabled_delete_nothing(self):
        old = timezone.now() - timezone.timedelta(days=3 * 365)
        self.make_user('stale', old)
        self.run_command('--months', '24', '--dry-run')
        self.run_command('--months', '0')
        self.assertEqual(get_user_model().objects.count(), 1)
