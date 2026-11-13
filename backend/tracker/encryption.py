"""Encrypted free-text fields of the tracker app (keys: see accounts/crypto.py).

Registry of (related name on the user, field) pairs that hold encrypted text; it drives
the legacy-plaintext migration and the data export.
"""

from accounts.crypto import decrypt_text, encrypt_text, is_encrypted

ENCRYPTED_FIELDS = {
    'time_entries': 'description',
    'daily_comments': 'comment',
    'hour_goals': 'comments',
    'monthly_courses': 'comments',
}


def encrypt_legacy_rows(user):
    """Encrypt this user's plaintext values stored before encryption existed.

    Called at login, when the user's key is in memory. Idempotent.
    """
    for related, field in ENCRYPTED_FIELDS.items():
        manager = getattr(user, related)
        rows = list(manager.exclude(**{field: ''}))
        changed = []
        for row in rows:
            value = getattr(row, field)
            if not is_encrypted(value):
                setattr(row, field, encrypt_text(user.pk, value))
                changed.append(row)
        if changed:
            manager.model.objects.bulk_update(changed, [field])


def decrypt_export_rows(user_id, rows, field):
    return [{**row, field: decrypt_text(user_id, row[field])} for row in rows]
