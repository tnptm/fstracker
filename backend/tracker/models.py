from django.conf import settings
from django.db import models
from django.db.models import F, Q


class Tracker(models.Model):
    """One block of voluntary work. `end_time` is null while the timer runs."""

    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='time_entries'
    )

    class Meta:
        ordering = ['-start_time']
        indexes = [models.Index(fields=['user', 'start_time'])]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_time__isnull=True) | Q(end_time__gt=F('start_time')),
                name='tracker_end_after_start',
            ),
            # At most one running timer per user.
            models.UniqueConstraint(
                fields=['user'],
                condition=Q(end_time__isnull=True),
                name='tracker_one_running_per_user',
            ),
        ]

    def __str__(self):
        return f'{self.user} {self.start_time:%Y-%m-%d %H:%M} – {self.end_time or "running"}'

    @property
    def is_running(self):
        return self.end_time is None


class MonthlyCourses(models.Model):
    """Number of courses held in a month. `month` is always the 1st day."""

    course_number = models.PositiveIntegerField()
    month = models.DateField()
    comments = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='monthly_courses'
    )

    class Meta:
        ordering = ['-month']
        verbose_name_plural = 'monthly courses'
        constraints = [
            models.UniqueConstraint(fields=['user', 'month'], name='courses_one_per_month'),
        ]

    def __str__(self):
        return f'{self.user} {self.month:%Y-%m}: {self.course_number} courses'


class MonthlyHourGoal(models.Model):
    """Target hours for a month. `month` is always the 1st day."""

    hour_goal = models.PositiveIntegerField()
    month = models.DateField()
    comments = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='hour_goals'
    )

    class Meta:
        ordering = ['-month']
        constraints = [
            models.UniqueConstraint(fields=['user', 'month'], name='goal_one_per_month'),
        ]

    def __str__(self):
        return f'{self.user} {self.month:%Y-%m}: {self.hour_goal} h goal'


class DailyComment(models.Model):
    """A note for a whole day without hours, e.g. day off or sick leave."""

    class Kind(models.TextChoices):
        DAY_OFF = 'day_off', 'Day off'
        SICK = 'sick', 'Sick'
        VACATION = 'vacation', 'Vacation'
        OTHER = 'other', 'Other'

    date = models.DateField()
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.DAY_OFF)
    comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='daily_comments'
    )

    class Meta:
        ordering = ['-date']
        constraints = [
            models.UniqueConstraint(fields=['user', 'date'], name='daily_comment_one_per_day'),
        ]

    def __str__(self):
        return f'{self.user} {self.date}: {self.get_kind_display()}'
