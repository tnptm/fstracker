from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers

from .models import PolicyAcceptance
from .usernames import random_username


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class UserSerializer(serializers.ModelSerializer):
    # False for accounts created before the policy existed or before its latest version:
    # the app then asks the user to read and accept it.
    privacy_accepted = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'privacy_accepted']

    def get_privacy_accepted(self, user):
        return user.policy_acceptances.filter(version=settings.PRIVACY_POLICY_VERSION).exists()


class RegisterSerializer(serializers.Serializer):
    """Anonymous sign-up: only a password. The server picks a random username and no
    email or name is collected (see accounts/usernames.py)."""

    password = serializers.CharField(
        write_only=True, trim_whitespace=False, max_length=128
    )
    password_confirm = serializers.CharField(
        write_only=True, trim_whitespace=False, max_length=128
    )
    # GDPR: the user must confirm they have read and accept the privacy policy.
    accept_privacy = serializers.BooleanField(write_only=True)
    # Honeypot: hidden in the form, humans leave it empty, naive bots fill it.
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate_accept_privacy(self, value):
        if value is not True:
            raise serializers.ValidationError(
                'You must accept the privacy policy to create an account.'
            )
        return value

    def validate(self, attrs):
        if attrs.pop('website', ''):
            raise serializers.ValidationError('Registration failed.')
        if attrs['password'] != attrs.pop('password_confirm'):
            raise serializers.ValidationError(
                {'password_confirm': 'Passwords do not match.'}
            )
        # Run AUTH_PASSWORD_VALIDATORS (length, common, numeric).
        try:
            validate_password(attrs['password'])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs

    def create(self, validated_data):
        User = get_user_model()
        for _ in range(10):
            try:
                with transaction.atomic():
                    user = User.objects.create_user(
                        username=random_username(), password=validated_data['password']
                    )
                break
            except IntegrityError:  # the random name was taken (practically never)
                continue
        else:
            raise serializers.ValidationError('Registration failed. Please try again.')
        PolicyAcceptance.objects.create(user=user, version=settings.PRIVACY_POLICY_VERSION)
        return user


class AccountUpdateSerializer(serializers.Serializer):
    """Accounts created before sign-up became anonymous may still have an email on file.
    The only supported change is removing it (the right to erasure for that field)."""

    email = serializers.CharField(allow_blank=True)

    def validate_email(self, value):
        if value != '':
            raise serializers.ValidationError('Only removing the email is supported.')
        return value


class AccountDeleteSerializer(serializers.Serializer):
    """Right to erasure: the password confirms it is really the account owner."""

    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_password(self, value):
        if not self.context['user'].check_password(value):
            raise serializers.ValidationError('Incorrect password.')
        return value
