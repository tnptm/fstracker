"""Month/date helpers. Boundaries use the server's TIME_ZONE (settings)."""

import datetime as dt
import re

from django.utils import timezone
from rest_framework.exceptions import ValidationError

MONTH_RE = re.compile(r'^(\d{4})-(\d{2})$')


def parse_month(value, field='month'):
    """'2026-11' -> date(2026, 11, 1). Raises a 400 ValidationError."""
    match = MONTH_RE.match(value or '')
    if not match:
        raise ValidationError({field: 'Use the format YYYY-MM.'})
    year, month = int(match[1]), int(match[2])
    if not 1 <= month <= 12 or year < 1900:
        raise ValidationError({field: 'Invalid month.'})
    return dt.date(year, month, 1)


def parse_date(value, field):
    try:
        return dt.date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValidationError({field: 'Use the format YYYY-MM-DD.'}) from None


def parse_year(value, field='year'):
    try:
        year = int(value)
    except (TypeError, ValueError):
        raise ValidationError({field: 'Invalid year.'}) from None
    if not 1900 <= year <= 9999:
        raise ValidationError({field: 'Invalid year.'})
    return year


def next_month(month):
    return dt.date(month.year + month.month // 12, month.month % 12 + 1, 1)


def day_start(day):
    """Aware datetime at local midnight of `day`."""
    return timezone.make_aware(dt.datetime.combine(day, dt.time.min))


def month_bounds(month):
    """Aware [start, end) datetimes for the month containing `month`."""
    first = month.replace(day=1)
    return day_start(first), day_start(next_month(first))


def current_month():
    return timezone.localdate().replace(day=1)
