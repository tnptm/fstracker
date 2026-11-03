from django.contrib import admin
from .models import Tracker, MontlyCourses, MonthlyHourGoal

# Register your models here.
admin.site.register(Tracker)
admin.site.register(MontlyCourses)
admin.site.register(MonthlyHourGoal)