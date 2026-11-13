from django.contrib import admin

from .models import PolicyAcceptance


@admin.register(PolicyAcceptance)
class PolicyAcceptanceAdmin(admin.ModelAdmin):
    list_display = ['user', 'version', 'accepted_at']
    list_filter = ['version']
    # Evidence records: viewable, never edited by hand.
    readonly_fields = ['user', 'version', 'accepted_at']

    def has_add_permission(self, request):
        return False
