from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(
        max_length=150, validators=[UnicodeUsernameValidator()]
    )
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(
        write_only=True, trim_whitespace=False, max_length=128
    )
    password_confirm = serializers.CharField(
        write_only=True, trim_whitespace=False, max_length=128
    )
    # Honeypot: hidden in the form, humans leave it empty, naive bots fill it.
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate_username(self, value):
        value = get_user_model().normalize_username(value)
        # Case-insensitive so "Alice" and "alice" can't both exist.
        if get_user_model().objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate_email(self, value):
        value = get_user_model().objects.normalize_email(value).lower()
        if get_user_model().objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('This email is already registered.')
        return value

    def validate(self, attrs):
        if attrs.pop('website', ''):
            raise serializers.ValidationError('Registration failed.')
        if attrs['password'] != attrs.pop('password_confirm'):
            raise serializers.ValidationError(
                {'password_confirm': 'Passwords do not match.'}
            )
        # Run AUTH_PASSWORD_VALIDATORS (length, common, numeric, similarity).
        candidate = get_user_model()(username=attrs['username'], email=attrs['email'])
        try:
            validate_password(attrs['password'], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs

    def create(self, validated_data):
        return get_user_model().objects.create_user(**validated_data)
