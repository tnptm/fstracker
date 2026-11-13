"""Random account names.

Accounts are anonymous: the username is a random string made by the server, and no
name or email is asked for. 12 characters from a 31-character alphabet is about
59 bits, so collisions are negligible and guessing a valid name is not practical.
The alphabet leaves out look-alike characters (0/o, 1/l/i) so it is easy to copy by hand.
"""

import secrets

ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
LENGTH = 12


def random_username():
    return ''.join(secrets.choice(ALPHABET) for _ in range(LENGTH))
