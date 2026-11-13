import datetime as dt

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.crypto import is_encrypted, key_store, unlock

from .dates import current_month, day_start
from .models import DailyComment, MonthlyHourGoal, Tracker


def aware(*args):
    return timezone.make_aware(dt.datetime(*args))


class ApiTestCase(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user('alice', password='pw-alice-123')
        self.other = User.objects.create_user('mallory', password='pw-mallory-123')
        key_store.clear()
        unlock(self.user, 'pw-alice-123')
        unlock(self.other, 'pw-mallory-123')
        self.client.force_authenticate(self.user)

    def entry(self, start, end, user=None, description=''):
        return Tracker.objects.create(
            user=user or self.user, start_time=start, end_time=end, description=description
        )


class AuthRequiredTests(APITestCase):
    def test_endpoints_require_login(self):
        for url in ['/api/entries/', '/api/daily-comments/', '/api/goals/', '/api/courses/',
                    '/api/stats/', '/api/entries/current/']:
            self.assertEqual(self.client.get(url).status_code, 401, url)
        self.assertEqual(self.client.post('/api/entries/start/').status_code, 401)


class TrackerTests(ApiTestCase):
    def test_manual_create_and_list(self):
        res = self.client.post('/api/entries/', {
            'start_time': '2026-10-01T09:00:00+03:00',
            'end_time': '2026-10-01T11:30:00+03:00',
            'description': 'Food bank',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['duration_seconds'], 9000)
        self.assertFalse(res.data['is_running'])
        self.assertEqual(Tracker.objects.get().user, self.user)

        res = self.client.get('/api/entries/?month=2026-10')
        self.assertEqual(len(res.data), 1)
        self.assertEqual(self.client.get('/api/entries/?month=2026-09').data, [])

    def test_manual_create_requires_end(self):
        res = self.client.post('/api/entries/', {'start_time': '2026-10-01T09:00:00Z'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('end_time', res.data)

    def test_end_before_start_rejected(self):
        res = self.client.post('/api/entries/', {
            'start_time': '2026-10-01T11:00:00Z', 'end_time': '2026-10-01T10:00:00Z',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('end_time', res.data)

    def test_future_rejected(self):
        future = timezone.now() + dt.timedelta(hours=2)
        res = self.client.post('/api/entries/', {
            'start_time': future.isoformat(), 'end_time': (future + dt.timedelta(hours=1)).isoformat(),
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_overlap_rejected(self):
        self.entry(aware(2026, 10, 1, 9), aware(2026, 10, 1, 11))
        res = self.client.post('/api/entries/', {
            'start_time': aware(2026, 10, 1, 10).isoformat(),
            'end_time': aware(2026, 10, 1, 12).isoformat(),
        }, format='json')
        self.assertEqual(res.status_code, 400)
        # Touching entries are fine.
        res = self.client.post('/api/entries/', {
            'start_time': aware(2026, 10, 1, 11).isoformat(),
            'end_time': aware(2026, 10, 1, 12).isoformat(),
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)

    def test_other_users_entries_do_not_overlap(self):
        self.entry(aware(2026, 10, 1, 9), aware(2026, 10, 1, 11), user=self.other)
        res = self.client.post('/api/entries/', {
            'start_time': aware(2026, 10, 1, 9).isoformat(),
            'end_time': aware(2026, 10, 1, 11).isoformat(),
        }, format='json')
        self.assertEqual(res.status_code, 201)

    def test_edit_times(self):
        e = self.entry(aware(2026, 10, 1, 9), aware(2026, 10, 1, 11))
        res = self.client.patch(f'/api/entries/{e.pk}/', {
            'end_time': aware(2026, 10, 1, 12).isoformat(), 'description': 'Longer shift',
        }, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        e.refresh_from_db()
        self.assertEqual(e.end_time, aware(2026, 10, 1, 12))
        self.assertEqual(res.data['description'], 'Longer shift')

    def test_cannot_access_other_users_entries(self):
        e = self.entry(aware(2026, 10, 1, 9), aware(2026, 10, 1, 11), user=self.other)
        self.assertEqual(self.client.get('/api/entries/').data, [])
        self.assertEqual(self.client.get(f'/api/entries/{e.pk}/').status_code, 404)
        self.assertEqual(self.client.patch(f'/api/entries/{e.pk}/', {'description': 'x'}).status_code, 404)
        self.assertEqual(self.client.delete(f'/api/entries/{e.pk}/').status_code, 404)
        self.assertTrue(Tracker.objects.filter(pk=e.pk).exists())

    def test_cannot_reassign_user(self):
        res = self.client.post('/api/entries/', {
            'start_time': aware(2026, 10, 1, 9).isoformat(),
            'end_time': aware(2026, 10, 1, 10).isoformat(),
            'user': self.other.pk,
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Tracker.objects.get().user, self.user)

    def test_start_stop_timer(self):
        self.assertIsNone(self.client.get('/api/entries/current/').data)
        res = self.client.post('/api/entries/start/', {'description': 'Library'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['is_running'])
        self.assertEqual(self.client.get('/api/entries/current/').data['id'], res.data['id'])

        # Double start is a conflict.
        self.assertEqual(self.client.post('/api/entries/start/').status_code, 409)

        # Comment can be edited while running.
        res = self.client.patch(f"/api/entries/{res.data['id']}/", {'description': 'Library, shelves'})
        self.assertEqual(res.status_code, 200, res.data)

        res = self.client.post('/api/entries/stop/', {}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['is_running'])
        self.assertEqual(res.data['description'], 'Library, shelves')
        self.assertGreaterEqual(res.data['duration_seconds'], 1)
        self.assertEqual(self.client.post('/api/entries/stop/').status_code, 409)

    def test_stop_can_set_description(self):
        self.client.post('/api/entries/start/')
        res = self.client.post('/api/entries/stop/', {'description': 'Done'}, format='json')
        self.assertEqual(res.data['description'], 'Done')

    def test_manual_entry_cannot_overlap_running_timer(self):
        self.entry(timezone.now() - dt.timedelta(hours=1), None)
        res = self.client.post('/api/entries/', {
            'start_time': (timezone.now() - dt.timedelta(minutes=30)).isoformat(),
            'end_time': (timezone.now() - dt.timedelta(minutes=10)).isoformat(),
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_list_limit_and_bad_filters(self):
        for h in range(3):
            self.entry(aware(2026, 10, 1, 9 + h), aware(2026, 10, 1, 9 + h, 30))
        res = self.client.get('/api/entries/?limit=2')
        self.assertEqual(len(res.data), 2)
        self.assertEqual(res.data[0]['start_time'][:13], aware(2026, 10, 1, 11).isoformat()[:13])
        self.assertEqual(self.client.get('/api/entries/?limit=abc').status_code, 400)
        self.assertEqual(self.client.get('/api/entries/?month=2026-13').status_code, 400)
        self.assertEqual(self.client.get('/api/entries/?from=yesterday').status_code, 400)


class DailyCommentTests(ApiTestCase):
    def test_crud_and_one_per_day(self):
        res = self.client.post('/api/daily-comments/', {
            'date': '2026-10-05', 'kind': 'sick', 'comment': 'Flu',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['kind_label'], 'Sick')
        res = self.client.post('/api/daily-comments/', {'date': '2026-10-05', 'kind': 'other'})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(len(self.client.get('/api/daily-comments/?month=2026-10').data), 1)
        self.assertEqual(self.client.get('/api/daily-comments/?month=2026-11').data, [])

    def test_invalid_kind(self):
        res = self.client.post('/api/daily-comments/', {'date': '2026-10-05', 'kind': 'party'})
        self.assertEqual(res.status_code, 400)

    def test_isolated_per_user(self):
        note = DailyComment.objects.create(user=self.other, date=dt.date(2026, 10, 5))
        self.assertEqual(self.client.get(f'/api/daily-comments/{note.pk}/').status_code, 404)
        # Same day is free for this user.
        res = self.client.post('/api/daily-comments/', {'date': '2026-10-05', 'kind': 'day_off'})
        self.assertEqual(res.status_code, 201)


class MonthValueTests(ApiTestCase):
    def test_goal_upsert(self):
        res = self.client.put('/api/goals/2026-11/', {'hour_goal': 20}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['month'], '2026-11')
        res = self.client.put('/api/goals/2026-11/', {'hour_goal': 25}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(MonthlyHourGoal.objects.get().hour_goal, 25)
        self.assertEqual(MonthlyHourGoal.objects.get().month, dt.date(2026, 11, 1))
        self.assertEqual(self.client.get('/api/goals/2026-11/').data['hour_goal'], 25)
        self.assertEqual(self.client.delete('/api/goals/2026-11/').status_code, 204)
        self.assertEqual(self.client.get('/api/goals/2026-11/').status_code, 404)

    def test_courses_upsert_and_year_filter(self):
        self.client.put('/api/courses/2026-11/', {'course_number': 3}, format='json')
        self.client.put('/api/courses/2025-11/', {'course_number': 1}, format='json')
        res = self.client.get('/api/courses/?year=2026')
        self.assertEqual([c['course_number'] for c in res.data], [3])

    def test_validation(self):
        self.assertEqual(self.client.put('/api/goals/2026-13/', {'hour_goal': 5}).status_code, 400)
        self.assertEqual(self.client.put('/api/goals/2026-11/', {'hour_goal': 0}).status_code, 400)
        self.assertEqual(self.client.put('/api/courses/2026-11/', {'course_number': -1}).status_code, 400)

    def test_isolated_per_user(self):
        MonthlyHourGoal.objects.create(user=self.other, month=dt.date(2026, 11, 1), hour_goal=99)
        self.assertEqual(self.client.get('/api/goals/2026-11/').status_code, 404)
        self.client.put('/api/goals/2026-11/', {'hour_goal': 10}, format='json')
        self.assertEqual(
            MonthlyHourGoal.objects.get(user=self.other).hour_goal, 99
        )


class StatsTests(ApiTestCase):
    def test_year_totals(self):
        self.entry(aware(2025, 3, 2, 9), aware(2025, 3, 2, 11))   # 2 h in March
        self.entry(aware(2025, 3, 9, 9), aware(2025, 3, 9, 9, 30))  # 0.5 h in March
        self.entry(aware(2025, 5, 1, 9), aware(2025, 5, 1, 10))   # 1 h in May
        self.entry(aware(2025, 5, 1, 9), aware(2025, 5, 1, 10), user=self.other)
        MonthlyHourGoal.objects.create(user=self.user, month=dt.date(2025, 3, 1), hour_goal=4)
        DailyComment.objects.create(user=self.user, date=dt.date(2025, 3, 5), kind='sick')

        data = self.client.get('/api/stats/?year=2025').data['year']
        march, may = data['months'][2], data['months'][4]
        self.assertEqual(march['seconds'], 9000)
        self.assertEqual(march['entries'], 2)
        self.assertEqual(march['goal_hours'], 4)
        self.assertEqual(march['day_notes'], 1)
        self.assertEqual(may['seconds'], 3600)
        self.assertIsNone(may['goal_hours'])
        self.assertEqual(data['total_seconds'], 12600)
        self.assertEqual(len(data['months']), 12)

    def test_current_month_progress(self):
        month = current_month()
        start = day_start(month) + dt.timedelta(minutes=1)
        self.entry(start, start + dt.timedelta(hours=2))
        MonthlyHourGoal.objects.create(user=self.user, month=month, hour_goal=8)

        cur = self.client.get('/api/stats/').data['current']
        self.assertEqual(cur['month'], month.strftime('%Y-%m'))
        self.assertEqual(cur['seconds'], 7200)
        self.assertEqual(cur['goal_hours'], 8)
        self.assertEqual(cur['progress'], 0.25)
        self.assertEqual(cur['remaining_seconds'], 6 * 3600)

    def test_running_timer_counts_until_now(self):
        # Clamp to today so the test also holds just after midnight.
        start = max(timezone.now() - dt.timedelta(minutes=30), day_start(timezone.localdate()))
        self.entry(start, None)
        expected = int((timezone.now() - start).total_seconds())
        cur = self.client.get('/api/stats/').data['current']
        self.assertGreaterEqual(cur['seconds'], expected)
        self.assertGreaterEqual(cur['today_seconds'], expected)

    def test_bad_year(self):
        self.assertEqual(self.client.get('/api/stats/?year=abc').status_code, 400)


class EncryptionTests(ApiTestCase):
    def test_description_is_stored_encrypted_and_returned_decrypted(self):
        res = self.client.post('/api/entries/', {
            'start_time': aware(2026, 10, 1, 9).isoformat(),
            'end_time': aware(2026, 10, 1, 11).isoformat(),
            'description': 'Helped Mr Virtanen',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['description'], 'Helped Mr Virtanen')
        stored = Tracker.objects.get(pk=res.data['id']).description
        self.assertTrue(is_encrypted(stored))
        self.assertNotIn('Virtanen', stored)
        self.assertEqual(
            self.client.get('/api/entries/').data[0]['description'], 'Helped Mr Virtanen'
        )

    def test_timer_start_and_stop_encrypt_descriptions(self):
        self.client.post('/api/entries/start/', {'description': 'Secret one'}, format='json')
        self.assertTrue(is_encrypted(Tracker.objects.get().description))
        res = self.client.post('/api/entries/stop/', {'description': 'Secret two'}, format='json')
        self.assertEqual(res.data['description'], 'Secret two')
        stored = Tracker.objects.get().description
        self.assertTrue(is_encrypted(stored))
        self.assertNotIn('Secret', stored)

    def test_notes_and_monthly_comments_are_encrypted(self):
        self.client.post('/api/daily-comments/', {
            'date': '2026-10-05', 'kind': 'sick', 'comment': 'Flu and fever',
        }, format='json')
        self.client.put('/api/goals/2026-10/', {'hour_goal': 10, 'comments': 'Private'}, format='json')
        self.assertTrue(is_encrypted(DailyComment.objects.get().comment))
        self.assertTrue(is_encrypted(MonthlyHourGoal.objects.get().comments))
        self.assertEqual(
            self.client.get('/api/daily-comments/').data[0]['comment'], 'Flu and fever'
        )
        self.assertEqual(self.client.get('/api/goals/2026-10/').data['comments'], 'Private')

    def test_legacy_plaintext_is_still_readable(self):
        self.entry(aware(2026, 10, 1, 9), aware(2026, 10, 1, 10), description='old plain text')
        self.assertEqual(self.client.get('/api/entries/').data[0]['description'], 'old plain text')

    def test_data_is_unreadable_without_the_key(self):
        self.client.post('/api/entries/start/', {'description': 'Hidden'}, format='json')
        key_store.drop(self.user.pk)
        res = self.client.get('/api/entries/')
        self.assertEqual(res.status_code, 401)
        self.assertNotIn('Hidden', str(res.data))
