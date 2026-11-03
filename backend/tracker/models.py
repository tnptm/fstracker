from django.db import models

# Create your models here.

class Tracker(models.Model):
    """tracking the start and end time of voluntary work, and some description"""
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)

    def __str__(self):
        return f"Tracker: {self.start_time} to {self.end_time}"



class MontlyCourses(models.Model):
    """setting a month and number of courses for that month"""
    course_number = models.IntegerField()
    month = models.DateField()
    comments = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)

    def __str__(self):
        return f"User {self.user.username } MontlyCourses: {self.course_number} for {self.month}"


class MonthlyHourGoal(models.Model):
    """setting a month and number of hours for that month"""
    hour_goal = models.IntegerField()
    month = models.DateField()
    comments = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)

    def __str__(self):
        return f"User {self.user.username } MonthlyHourGoal: {self.hour_goal} for {self.month}"