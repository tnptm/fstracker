import datetime as dt

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .dates import current_month, day_start, month_bounds, parse_date, parse_month, parse_year
from .models import DailyComment, MonthlyCourses, MonthlyHourGoal, Tracker
from .serializers import (
    DailyCommentSerializer,
    MonthlyCoursesSerializer,
    MonthlyHourGoalSerializer,
    TimerStartSerializer,
    TrackerSerializer,
)
from .stats import current_month_stats, year_stats

MAX_LIMIT = 500


class UserOwnedMixin:
    """Every query is scoped to request.user; new objects belong to request.user.

    Objects of other users return 404 (not 403) so their existence isn't leaked.
    """

    model = None

    def get_queryset(self):
        return self.model.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TrackerViewSet(UserOwnedMixin, viewsets.ModelViewSet):
    """Time entries.

    List filters: `?month=YYYY-MM`, or `?from=YYYY-MM-DD&to=YYYY-MM-DD` (inclusive),
    plus `?limit=N` for the N most recent.
    """

    model = Tracker
    serializer_class = TrackerSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action != 'list':
            return qs
        params = self.request.query_params
        if month := params.get('month'):
            start, end = month_bounds(parse_month(month))
            qs = qs.filter(start_time__gte=start, start_time__lt=end)
        if date_from := params.get('from'):
            qs = qs.filter(start_time__gte=day_start(parse_date(date_from, 'from')))
        if date_to := params.get('to'):
            to = parse_date(date_to, 'to')
            qs = qs.filter(start_time__lt=day_start(to + dt.timedelta(days=1)))
        if limit := params.get('limit'):
            if not limit.isdigit() or not 1 <= int(limit) <= MAX_LIMIT:
                raise ValidationError({'limit': f'Use a number between 1 and {MAX_LIMIT}.'})
            qs = qs[: int(limit)]
        return qs

    def _save(self, serializer, **kwargs):
        # The DB constraints are the final guard against races (e.g. double start).
        try:
            with transaction.atomic():
                serializer.save(**kwargs)
        except IntegrityError:
            raise ValidationError('This conflicts with another entry.') from None

    def perform_create(self, serializer):
        self._save(serializer, user=self.request.user)

    def perform_update(self, serializer):
        self._save(serializer)

    @action(detail=False, methods=['get'])
    def current(self, request):
        """The running entry, or null."""
        entry = self.get_queryset().filter(end_time__isnull=True).first()
        return Response(self.get_serializer(entry).data if entry else None)

    @action(detail=False, methods=['post'])
    def start(self, request):
        params = TimerStartSerializer(data=request.data)
        params.is_valid(raise_exception=True)
        if self.get_queryset().filter(end_time__isnull=True).exists():
            return Response(
                {'detail': 'A timer is already running.'}, status=status.HTTP_409_CONFLICT
            )
        serializer = self.get_serializer(
            data={'start_time': timezone.now(), 'end_time': None, **params.validated_data}
        )
        serializer.context['allow_running'] = True
        serializer.is_valid(raise_exception=True)
        self._save(serializer, user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def stop(self, request):
        params = TimerStartSerializer(data=request.data)
        params.is_valid(raise_exception=True)
        entry = self.get_queryset().filter(end_time__isnull=True).first()
        if entry is None:
            return Response({'detail': 'No timer is running.'}, status=status.HTTP_409_CONFLICT)
        entry.end_time = max(timezone.now(), entry.start_time + dt.timedelta(seconds=1))
        if 'description' in params.validated_data:
            entry.description = params.validated_data['description']
        entry.save(update_fields=['end_time', 'description', 'updated_at'])
        return Response(self.get_serializer(entry).data)


class DailyCommentViewSet(UserOwnedMixin, viewsets.ModelViewSet):
    """Whole-day notes. List filter: `?month=YYYY-MM`."""

    model = DailyComment
    serializer_class = DailyCommentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == 'list' and (month := self.request.query_params.get('month')):
            first = parse_month(month)
            qs = qs.filter(date__year=first.year, date__month=first.month)
        return qs


class MonthValueViewSet(
    UserOwnedMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """One value per user and month, addressed as /<resource>/YYYY-MM/.

    PUT creates or replaces the value for that month. List filter: `?year=YYYY`.
    """

    lookup_field = 'month'
    lookup_value_regex = r'\d{4}-\d{2}'

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == 'list' and (year := self.request.query_params.get('year')):
            qs = qs.filter(month__year=parse_year(year))
        return qs

    def get_object(self):
        return get_object_or_404(self.get_queryset(), month=parse_month(self.kwargs['month']))

    def update(self, request, *args, **kwargs):
        month = parse_month(self.kwargs['month'])
        instance = self.get_queryset().filter(month=month).first()
        serializer = self.get_serializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, month=month)
        return Response(
            serializer.data, status=status.HTTP_200_OK if instance else status.HTTP_201_CREATED
        )


class MonthlyHourGoalViewSet(MonthValueViewSet):
    model = MonthlyHourGoal
    serializer_class = MonthlyHourGoalSerializer


class MonthlyCoursesViewSet(MonthValueViewSet):
    model = MonthlyCourses
    serializer_class = MonthlyCoursesSerializer


class StatsView(APIView):
    """`?year=YYYY` (default: current year) monthly totals + current month progress."""

    def get(self, request):
        year_param = request.query_params.get('year')
        year = parse_year(year_param) if year_param else current_month().year
        return Response(
            {
                'current': current_month_stats(request.user),
                'year': year_stats(request.user, year),
            }
        )
