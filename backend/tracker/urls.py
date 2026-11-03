from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register('entries', views.TrackerViewSet, basename='entry')
router.register('daily-comments', views.DailyCommentViewSet, basename='daily-comment')
router.register('goals', views.MonthlyHourGoalViewSet, basename='goal')
router.register('courses', views.MonthlyCoursesViewSet, basename='courses')

urlpatterns = [
    path('stats/', views.StatsView.as_view(), name='stats'),
    *router.urls,
]
