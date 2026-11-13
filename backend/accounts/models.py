from django.conf import settings
from django.db import models


class PolicyAcceptance(models.Model):
    """Proof that a user accepted a version of the privacy policy.

    One row per acceptance, so a future policy version can ask for a new one while the
    history stays. Rows are deleted with the user (account erasure).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='policy_acceptances'
    )
    version = models.CharField(max_length=32)
    accepted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-accepted_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'version'], name='one_acceptance_per_version'),
        ]

    def __str__(self):
        return f'{self.user} accepted {self.version} at {self.accepted_at:%Y-%m-%d %H:%M}'


class UserEncryption(models.Model):
    """Random salt for deriving the user's text-encryption key from their password.

    The key itself is never stored (see accounts/crypto.py). Deleted with the user.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='encryption'
    )
    salt = models.BinaryField(max_length=16)

    def __str__(self):
        return f'Encryption salt for {self.user}'
