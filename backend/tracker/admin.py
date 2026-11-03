from django.contrib import admin

from .models import DailyComment, MonthlyCourses, MonthlyHourGoal, Tracker


@admin.register(Tracker)
class TrackerAdmin(admin.ModelAdmin):
    list_display = ['user', 'start_time', 'end_time', 'description']
    list_filter = ['user']
    date_hierarchy = 'start_time'
    search_fields = ['description']


@admin.register(MonthlyCourses)
class MonthlyCoursesAdmin(admin.ModelAdmin):
    list_display = ['user', 'month', 'course_number']
    list_filter = ['user']


@admin.register(MonthlyHourGoal)
class MonthlyHourGoalAdmin(admin.ModelAdmin):
    list_display = ['user', 'month', 'hour_goal']
    list_filter = ['user']


@admin.register(DailyComment)
class DailyCommentAdmin(admin.ModelAdmin):
    list_display = ['user', 'date', 'kind', 'comment']
    list_filter = ['user', 'kind']
    date_hierarchy = 'date'
