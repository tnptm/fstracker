"""Hour statistics. Entries count toward the month/day they start in."""

import datetime as dt
from collections import defaultdict

from django.db.models import Q
from django.utils import timezone

from .dates import day_start, month_bounds, next_month
from .models import DailyComment, MonthlyCourses, MonthlyHourGoal, Tracker


def _seconds(entry, now):
    end = entry.end_time or now
    return max(0, (end - entry.start_time).total_seconds())


def _entries_between(user, start, end):
    return Tracker.objects.filter(user=user, start_time__gte=start, start_time__lt=end).only(
        'start_time', 'end_time'
    )


def year_stats(user, year):
    now = timezone.now()
    start, end = day_start(dt.date(year, 1, 1)), day_start(dt.date(year + 1, 1, 1))

    seconds = defaultdict(float)
    counts = defaultdict(int)
    for entry in _entries_between(user, start, end):
        key = timezone.localtime(entry.start_time).month
        seconds[key] += _seconds(entry, now)
        counts[key] += 1

    in_year = Q(month__year=year)
    goals = {g.month.month: g.hour_goal for g in MonthlyHourGoal.objects.filter(in_year, user=user)}
    courses = {
        c.month.month: c.course_number for c in MonthlyCourses.objects.filter(in_year, user=user)
    }
    days_off = defaultdict(int)
    for note in DailyComment.objects.filter(user=user, date__year=year).only('date'):
        days_off[note.date.month] += 1

    months = [
        {
            'month': f'{year}-{m:02d}',
            'seconds': int(seconds[m]),
            'entries': counts[m],
            'goal_hours': goals.get(m),
            'courses': courses.get(m),
            'day_notes': days_off[m],
        }
        for m in range(1, 13)
    ]
    return {
        'year': year,
        'months': months,
        'total_seconds': sum(m['seconds'] for m in months),
        'total_entries': sum(m['entries'] for m in months),
        'total_courses': sum(m['courses'] or 0 for m in months),
    }


def current_month_stats(user):
    now = timezone.now()
    today = timezone.localdate()
    month = today.replace(day=1)
    start, end = month_bounds(month)
    today_start = day_start(today)

    month_seconds = 0.0
    today_seconds = 0.0
    entries = 0
    for entry in _entries_between(user, start, end):
        secs = _seconds(entry, now)
        month_seconds += secs
        entries += 1
        if entry.start_time >= today_start:
            today_seconds += secs

    goal = MonthlyHourGoal.objects.filter(user=user, month=month).first()
    courses = MonthlyCourses.objects.filter(user=user, month=month).first()
    days_in_month = (next_month(month) - month).days
    elapsed = min(1.0, max(0.0, (now - start).total_seconds() / (end - start).total_seconds()))

    goal_seconds = goal.hour_goal * 3600 if goal else None
    return {
        'month': month.strftime('%Y-%m'),
        'seconds': int(month_seconds),
        'today_seconds': int(today_seconds),
        'entries': entries,
        'goal_hours': goal.hour_goal if goal else None,
        # Where you'd be today if hours were spread evenly over the month.
        'expected_seconds': int(goal_seconds * elapsed) if goal_seconds else None,
        'remaining_seconds': max(0, int(goal_seconds - month_seconds)) if goal_seconds else None,
        'progress': round(month_seconds / goal_seconds, 4) if goal_seconds else None,
        'days_left': days_in_month - today.day + 1,
        'days_in_month': days_in_month,
        'courses': courses.course_number if courses else None,
        'day_notes': DailyComment.objects.filter(
            user=user, date__gte=month, date__lt=next_month(month)
        ).count(),
    }
