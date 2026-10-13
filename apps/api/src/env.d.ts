// Secrets are supplied by .dev.vars locally and Wrangler Secrets in production.
interface Env {
  EXPO_ACCESS_TOKEN?: string;
  ADMIN_USER_IDS?: string;
  BETTER_AUTH_SECRET: string;
  RESEND_API_KEY: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
}
