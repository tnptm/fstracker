// Facts shown on the privacy policy page. Keep the version in sync with
// PRIVACY_POLICY_VERSION in backend/config/settings.py: the backend stores it with each
// acceptance. When you change the policy text, bump both and the date below.
export const POLICY_VERSION = "2026-11-13";
export const POLICY_UPDATED = "13 November 2026";

// The data controller (who decides how the data is used).
export const CONTROLLER_NAME = "tnptm";
export const CONTROLLER_URL = "https://github.com/tnptm";
// Set a contact email here to show it on the policy page; leave null to show only the URL.
export const CONTROLLER_EMAIL: string | null = "info@tnptm.ovh";

// How long an unused account is kept; keep in sync with DJANGO_INACTIVE_ACCOUNT_MONTHS.
export const INACTIVE_ACCOUNT_MONTHS = 24;
