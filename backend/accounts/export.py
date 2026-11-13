"""Right of access / data portability: everything we store about one user.

If you add a model or field that holds personal data, add it here too (and to the
privacy policy and docs/DATA_HANDLING.md).
"""

from django.conf import settings
from django.utils import timezone

from tracker.encryption import decrypt_export_rows


def export_user_data(user):
    return {
        'exported_at': timezone.now(),
        'format_version': 1,
        'account': {
            'id': user.pk,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'date_joined': user.date_joined,
            'last_login': user.last_login,
            # Passwords are stored only as a salted hash and are not exported.
        },
        'privacy_policy_acceptances': list(
            user.policy_acceptances.order_by('accepted_at').values('version', 'accepted_at')
        ),
        'current_privacy_policy_version': settings.PRIVACY_POLICY_VERSION,
        # Free text is stored encrypted; the export has it decrypted (needs the user's key).
        'time_entries': decrypt_export_rows(
            user.pk,
            user.time_entries.order_by('start_time').values(
                'start_time', 'end_time', 'description', 'created_at', 'updated_at'
            ),
            'description',
        ),
        'daily_comments': decrypt_export_rows(
            user.pk,
            user.daily_comments.order_by('date').values(
                'date', 'kind', 'comment', 'created_at', 'updated_at'
            ),
            'comment',
        ),
        'monthly_hour_goals': decrypt_export_rows(
            user.pk,
            user.hour_goals.order_by('month').values(
                'month', 'hour_goal', 'comments', 'created_at', 'updated_at'
            ),
            'comments',
        ),
        'monthly_courses': decrypt_export_rows(
            user.pk,
            user.monthly_courses.order_by('month').values(
                'month', 'course_number', 'comments', 'created_at', 'updated_at'
            ),
            'comments',
        ),
    }
