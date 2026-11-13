import datetime as dt

from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.fields import empty

from accounts.crypto import decrypt_text, encrypt_text

from .dates import parse_month
from .models import DailyComment, MonthlyCourses, MonthlyHourGoal, Tracker

# Small tolerance for client/server clock drift when rejecting future times.
CLOCK_SKEW = dt.timedelta(minutes=2)


class EncryptedCharField(serializers.CharField):
    """Text stored encrypted with the requesting user's key (accounts/crypto.py).

    Length limits apply to the plaintext; the value is encrypted after validation.
    """

    def _user_id(self):
        return self.context['request'].user.pk

    def to_representation(self, value):
        return decrypt_text(self._user_id(), value)

    def run_validation(self, data=empty):
        value = super().run_validation(data)
        return encrypt_text(self._user_id(), value)


class TrackerSerializer(serializers.ModelSerializer):
    description = EncryptedCharField(required=False, allow_blank=True, max_length=2000)
    duration_seconds = serializers.SerializerMethodField()
    is_running = serializers.BooleanField(read_only=True)

    class Meta:
        model = Tracker
        fields = [
            'id', 'start_time', 'end_time', 'description',
            'duration_seconds', 'is_running', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_duration_seconds(self, obj):
        end = obj.end_time or timezone.now()
        return max(0, int((end - obj.start_time).total_seconds()))

    def validate(self, attrs):
        instance = self.instance
        start = attrs.get('start_time', getattr(instance, 'start_time', None))
        end = attrs['end_time'] if 'end_time' in attrs else getattr(instance, 'end_time', None)
        user = self.context['request'].user
        now = timezone.now()

        if start is None:
            raise serializers.ValidationError({'start_time': 'This field is required.'})
        if instance is None and end is None and not self.context.get('allow_running'):
            raise serializers.ValidationError(
                {'end_time': 'End time is required. Use the timer to start a running entry.'}
            )
        if start > now + CLOCK_SKEW:
            raise serializers.ValidationError({'start_time': 'Start time cannot be in the future.'})
        if end is not None:
            if end <= start:
                raise serializers.ValidationError({'end_time': 'End time must be after start time.'})
            if end > now + CLOCK_SKEW:
                raise serializers.ValidationError({'end_time': 'End time cannot be in the future.'})

        others = Tracker.objects.filter(user=user)
        if instance is not None:
            others = others.exclude(pk=instance.pk)

        if end is None and others.filter(end_time__isnull=True).exists():
            raise serializers.ValidationError('Another timer is already running.')

        # Overlap: another entry starts before this one ends and ends after this one starts.
        # Running entries count as ending now.
        overlapping = others.filter(start_time__lt=end or now).filter(
            Q(end_time__gt=start) | Q(end_time__isnull=True)
        )
        if overlapping.exists():
            raise serializers.ValidationError('This time overlaps with another entry.')
        return attrs


class TimerStartSerializer(serializers.Serializer):
    description = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class DailyCommentSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    comment = EncryptedCharField(required=False, allow_blank=True, max_length=2000)

    class Meta:
        model = DailyComment
        fields = ['id', 'date', 'kind', 'kind_label', 'comment', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def validate_date(self, value):
        user = self.context['request'].user
        qs = DailyComment.objects.filter(user=user, date=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('There is already a note for this day.')
        return value


class MonthField(serializers.Field):
    """Represents a first-of-month date as 'YYYY-MM'."""

    def to_representation(self, value):
        return value.strftime('%Y-%m')

    def to_internal_value(self, data):
        return parse_month(data)


class MonthlyCoursesSerializer(serializers.ModelSerializer):
    month = MonthField(read_only=True)
    comments = EncryptedCharField(required=False, allow_blank=True)

    class Meta:
        model = MonthlyCourses
        fields = ['id', 'month', 'course_number', 'comments', 'updated_at']
        read_only_fields = ['updated_at']
        extra_kwargs = {'course_number': {'max_value': 1000}}


class MonthlyHourGoalSerializer(serializers.ModelSerializer):
    month = MonthField(read_only=True)
    comments = EncryptedCharField(required=False, allow_blank=True)

    class Meta:
        model = MonthlyHourGoal
        fields = ['id', 'month', 'hour_goal', 'comments', 'updated_at']
        read_only_fields = ['updated_at']
        extra_kwargs = {'hour_goal': {'min_value': 1, 'max_value': 744}}
