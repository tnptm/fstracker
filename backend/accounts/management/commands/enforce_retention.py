"""Apply the data retention rules (see docs/DATA_HANDLING.md).

* Deletes accounts that have not been used for INACTIVE_ACCOUNT_MONTHS months,
  together with everything they own. Staff/admin accounts are never touched.
* Removes expired JWT rows (token ids only, no personal data) from the database.

Run it regularly, e.g. daily from cron:
    docker compose --env-file .env.prod -f compose.prod.yaml exec -T backend \
        python manage.py enforce_retention
Use --dry-run first to see who would be deleted.
"""

from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

DAYS_PER_MONTH = 30.44


class Command(BaseCommand):
    help = 'Delete long-inactive accounts and expired token rows.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--months',
            type=int,
            default=settings.INACTIVE_ACCOUNT_MONTHS,
            help='Inactivity limit in months (default: DJANGO_INACTIVE_ACCOUNT_MONTHS, 0 = off).',
        )
        parser.add_argument('--dry-run', action='store_true', help='Only list what would be deleted.')

    def handle(self, *args, months, dry_run, **options):
        if months > 0:
            self.purge_inactive(months, dry_run)
        else:
            self.stdout.write('Inactive account deletion is disabled (months = 0).')

        if dry_run:
            self.stdout.write('Dry run: expired tokens not flushed.')
        else:
            call_command('flushexpiredtokens', verbosity=0)
            self.stdout.write('Expired tokens flushed.')

    def purge_inactive(self, months, dry_run):
        cutoff = timezone.now() - timedelta(days=round(months * DAYS_PER_MONTH))
        candidates = (
            get_user_model()
            .objects.filter(is_staff=False, is_superuser=False)
            .annotate(last_seen=Coalesce('last_login', 'date_joined'))
            .filter(last_seen__lt=cutoff)
        )
        deleted = 0
        for user in candidates:
            # last_login only changes on a password login, but an active session
            # refreshes its token (a new row) at least every 15 minutes of use.
            if OutstandingToken.objects.filter(user=user, created_at__gte=cutoff).exists():
                continue
            label = f'user id={user.pk} (last seen {user.last_seen:%Y-%m-%d})'
            if dry_run:
                self.stdout.write(f'Would delete {label}')
            else:
                OutstandingToken.objects.filter(user=user).delete()
                user.delete()
                self.stdout.write(f'Deleted {label}')
            deleted += 1
        verb = 'would be deleted' if dry_run else 'deleted'
        self.stdout.write(f'{deleted} inactive account(s) {verb} (unused for {months}+ months).')
