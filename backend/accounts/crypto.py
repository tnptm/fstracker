"""Per-user encryption of free-text fields (entry descriptions, notes).

The key is derived from the user's password (scrypt + a per-user random salt), so the
server can only read the text while the user is signed in:

- On login/registration the password is available for a moment; `unlock()` derives the key
  and keeps it in the process memory in `key_store`. Neither the password nor the key is
  ever written to disk, the database, a cookie or a log.
- Requests read the key from `key_store` by user id to encrypt on save and decrypt on read.
- The key is dropped on logout, account erasure, after `ENCRYPTION_KEY_IDLE_SECONDS` without
  use, and when the process restarts. A session without a key is treated as ended
  (see `CookieJWTAuthentication`), so the user signs in again and the key is re-derived.

Because the key lives in one process' memory the backend must run a single worker process
(threads are fine); see backend/gunicorn.conf.py.

Stored values look like `enc1:<fernet token>`. Values without the prefix are legacy
plaintext: they are returned as is and encrypted at the user's next login.
"""

import base64
import hashlib
import logging
import os
import threading
import time

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from rest_framework.exceptions import NotAuthenticated

PREFIX = 'enc1:'
SALT_BYTES = 16
# scrypt parameters (~16 MiB, tens of milliseconds): only run at login.
_SCRYPT = {'n': 2**14, 'r': 8, 'p': 1, 'dklen': 32, 'maxmem': 64 * 1024 * 1024}

logger = logging.getLogger(__name__)


class EncryptionKeyUnavailable(NotAuthenticated):
    default_detail = 'Your session has no encryption key. Please sign in again.'
    default_code = 'encryption_key_unavailable'


def derive_key(password: str, salt: bytes) -> bytes:
    raw = hashlib.scrypt(password.encode('utf-8'), salt=salt, **_SCRYPT)
    return base64.urlsafe_b64encode(raw)


class KeyStore:
    """In-memory, thread-safe map: user id -> encryption key, with idle expiry."""

    def __init__(self, idle_seconds=None):
        self._lock = threading.Lock()
        self._keys = {}  # user_id -> [Fernet, last_used_monotonic]
        self._idle_seconds = idle_seconds

    @property
    def idle_seconds(self):
        if self._idle_seconds is not None:
            return self._idle_seconds
        return settings.ENCRYPTION_KEY_IDLE_SECONDS

    def put(self, user_id, key: bytes):
        with self._lock:
            self._purge_expired()
            self._keys[user_id] = [Fernet(key), time.monotonic()]

    def get(self, user_id):
        """The user's Fernet (and extend its idle lifetime), or None."""
        with self._lock:
            entry = self._keys.get(user_id)
            if entry is None:
                return None
            now = time.monotonic()
            if now - entry[1] > self.idle_seconds:
                del self._keys[user_id]
                return None
            entry[1] = now
            return entry[0]

    def has(self, user_id) -> bool:
        return self.get(user_id) is not None

    def drop(self, user_id):
        with self._lock:
            self._keys.pop(user_id, None)

    def clear(self):
        with self._lock:
            self._keys.clear()

    def _purge_expired(self):
        now = time.monotonic()
        for user_id in [u for u, e in self._keys.items() if now - e[1] > self.idle_seconds]:
            del self._keys[user_id]


key_store = KeyStore()


def unlock(user, password: str):
    """Derive the user's key from their (already verified) password and keep it in memory."""
    from .models import UserEncryption

    record, _ = UserEncryption.objects.get_or_create(
        user=user, defaults={'salt': os.urandom(SALT_BYTES)}
    )
    key_store.put(user.pk, derive_key(password, bytes(record.salt)))


def lock(user_id):
    key_store.drop(user_id)


def _fernet(user_id) -> Fernet:
    fernet = key_store.get(user_id)
    if fernet is None:
        raise EncryptionKeyUnavailable()
    return fernet


def is_encrypted(value) -> bool:
    return isinstance(value, str) and value.startswith(PREFIX)


def encrypt_text(user_id, text: str) -> str:
    if not text:
        return ''
    return PREFIX + _fernet(user_id).encrypt(text.encode('utf-8')).decode('ascii')


def decrypt_text(user_id, value: str) -> str:
    if not value or not is_encrypted(value):
        return value or ''  # empty, or legacy plaintext awaiting migration
    try:
        return _fernet(user_id).decrypt(value[len(PREFIX):].encode('ascii')).decode('utf-8')
    except InvalidToken:
        # Written with a different key (e.g. the password was changed outside the app).
        logger.warning('Could not decrypt a stored value for user id %s', user_id)
        return ''
