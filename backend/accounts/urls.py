from django.urls import path

from . import views

urlpatterns = [
    path('csrf/', views.CsrfView.as_view(), name='auth-csrf'),
    path('login/', views.LoginView.as_view(), name='auth-login'),
    path('register/', views.RegisterView.as_view(), name='auth-register'),
    path('refresh/', views.RefreshView.as_view(), name='auth-refresh'),
    path('logout/', views.LogoutView.as_view(), name='auth-logout'),
    path('me/', views.MeView.as_view(), name='auth-me'),
    path('privacy/accept/', views.AcceptPrivacyView.as_view(), name='auth-privacy-accept'),
    path('me/export/', views.ExportView.as_view(), name='auth-export'),
]
