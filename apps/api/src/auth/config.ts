import { hasMissingProviderToken } from "../services/revoke-provider-tokens";
import { allowedOrigins } from "../origins";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { DASHBOARD_ORIGIN, infrastructurePlugins } from "./infrastructure";
import {
  sendAuthEmail,
  verificationEmail,
  resetEmail,
  accountDeletionEmail,
} from "./email";

import {
  accountDeletionPending,
  beginAccountDeletion,
  processAccountDeletion,
} from "../services/account-deletion";

export function socialProviders(env: Env) {
  return {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            // A Google account whose email Google has not verified gets no
            // session, from the browser flow and from the native ID-token exchange.
            requireEmailVerification: true,
          },
        }
      : {}),
  };
}
export function createAuth(
  env: Env,
  execution?: Pick<ExecutionContext, "waitUntil">,
) {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)
    throw new APIError("SERVICE_UNAVAILABLE", {
      message: "認証シークレットを設定してください",
    });
  let verificationDeliveryError: Error | undefined;
  let deletionDeliveryError: Error | undefined;
  return betterAuth({
    appName: "Flocka",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      ...allowedOrigins(env),
      "flocka://",
      ...(env.BETTER_AUTH_API_KEY?.trim() ? [DASHBOARD_ORIGIN] : []),
    ],
    database: drizzleAdapter(drizzle(env.DB), {
      provider: "sqlite",
      schema,
      transaction: false,
    }),
    advanced: {
      database: { generateId: "uuid" },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    account: { encryptOAuthTokens: true },
    databaseHooks: {
      session: {
        create: {
          async after(session) {
            // Covers an intent accepted between the before hook and INSERT.
            if (await accountDeletionPending(env.DB, session.userId)) {
              await env.DB.prepare("DELETE FROM auth_sessions WHERE id = ?")
                .bind(session.id)
                .run();
              throw new APIError("FORBIDDEN", {
                code: "ACCOUNT_DELETION_PENDING",
                message: "アカウントの削除を処理中です",
              });
            }
          },
          async before(session) {
            if (await accountDeletionPending(env.DB, session.userId))
              throw new APIError("FORBIDDEN", {
                code: "ACCOUNT_DELETION_PENDING",
                message: "アカウントの削除を処理中です",
              });
          },
        },
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        deleteTokenExpiresIn: 1800,
        async sendDeleteAccountVerification({ user, url, token }) {
          const target = new URL(url).searchParams.get("callbackURL");
          if (!target)
            throw new APIError("BAD_REQUEST", {
              message: "削除の確認画面を指定してください",
            });
          const link = new URL(target);
          link.searchParams.set("token", token);
          try {
            await sendAuthEmail(
              env,
              accountDeletionEmail(user.email, link.href),
            );
          } catch (error) {
            await env.DB.prepare(
              "DELETE FROM auth_verifications WHERE identifier = ?",
            )
              .bind(`delete-account-${token}`)
              .run();
            deletionDeliveryError =
              error instanceof Error
                ? error
                : new Error("メール配信に失敗しました");
            throw error;
          }
        },
        async beforeDelete(user) {
          if (await hasMissingProviderToken(env.DB, user.id))
            throw new APIError("BAD_REQUEST", {
              code: "PROVIDER_REAUTHENTICATION_REQUIRED",
              message:
                "連携先の認証情報を確認できません。Google連携の場合は、一度ログアウトし、Googleでログインし直してから、確認メールをもう一度送信してください。それ以外の場合は運営にお問い合わせください",
            });
          await beginAccountDeletion(env, user.id);
          if (!(await processAccountDeletion(env, user.id)))
            throw new APIError("SERVICE_UNAVAILABLE", {
              code: "ACCOUNT_DELETION_PENDING",
              message:
                "削除を受け付けました。現在処理中です。完了までサーバーで再試行します。",
            });
        },
      },
      additionalFields: {
        termsAccepted: {
          type: "boolean",
          required: false,
          defaultValue: false,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 1800,
      async sendResetPassword({ user, url }) {
        const delivery = sendAuthEmail(env, resetEmail(user.email, url));
        // Equal public responses for registered and unknown addresses.
        if (execution)
          execution.waitUntil(
            delivery.catch(() =>
              console.error("auth.password_reset_delivery_failed"),
            ),
          );
        else await delivery;
      },
    },
    // sendOnSignUp stays false: an unverified Google email must not trigger mail
    // (there is no verification-link sender; the app verifies by code).
    emailVerification: {
      autoSignInAfterVerification: true,
      sendOnSignUp: false,
    },
    socialProviders: socialProviders(env),
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    // Better Auth 1.7.7 keys every rule by client IP and path; a rule can change
    // window/max but not the key, so per-email limits are not available here.
    // Distinct IPs targeting one address are bounded only by these IP rules,
    // the OTP's attempt limit and its 10-minute expiry (docs/architecture.md).
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 30,
      customRules: {
        "/sign-up/email": { window: 60, max: 5 },
        // Stricter than the built-in 3 per 10 seconds (18 per minute) per IP.
        "/sign-in/email": { window: 60, max: 5 },
        "/email-otp/send-verification-otp": { window: 30, max: 1 },
        "/email-otp/verify-email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/delete-user": { window: 60, max: 3 },
      },
    },
    hooks: {
      // Better Auth catches email callback failures. Surface them for the explicit resend request.
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/delete-user" && deletionDeliveryError)
          throw deletionDeliveryError;
        if (
          ctx.path === "/email-otp/send-verification-otp" &&
          verificationDeliveryError
        )
          throw verificationDeliveryError;
      }),
      before: createAuthMiddleware(async (ctx) => {
        // Never perform destructive work on GET (mail scanners can prefetch links).
        if (ctx.path === "/delete-user/callback")
          throw new APIError("METHOD_NOT_ALLOWED", {
            message: "確認画面で削除を確定してください",
          });
        if (ctx.path === "/delete-user" && !ctx.body?.token) {
          let target: URL;
          try {
            target = new URL(ctx.body?.callbackURL ?? "");
          } catch {
            throw new APIError("BAD_REQUEST", {
              message: "削除の確認画面を指定してください",
            });
          }
          const isApp =
            target.protocol === "flocka:" &&
            target.host === "delete-account" &&
            target.pathname === "";
          const isWeb =
            allowedOrigins(env).includes(target.origin) &&
            target.pathname === "/delete-account";
          if (
            (!isApp && !isWeb) ||
            target.username ||
            target.password ||
            target.search ||
            target.hash
          )
            throw new APIError("BAD_REQUEST", {
              message: "削除の確認画面が無効です",
            });
        }
        if (ctx.path === "/sign-up/email" && ctx.body?.termsAccepted !== true)
          throw new APIError("BAD_REQUEST", {
            code: "TERMS_REQUIRED",
            message: "利用規約とプライバシーポリシーへの同意が必要です",
          });
        const password =
          ctx.path === "/sign-up/email"
            ? ctx.body?.password
            : ctx.path === "/reset-password"
              ? ctx.body?.newPassword
              : undefined;
        if (
          password !== undefined &&
          (typeof password !== "string" ||
            !/[A-Za-z]/.test(password) ||
            !/\d/.test(password))
        )
          throw new APIError("BAD_REQUEST", {
            code: "PASSWORD_POLICY",
            message: "パスワードには英字と数字を含めてください",
          });
        // OTP is for verification only. Do not expose a parallel passwordless login.
        if (
          ctx.path === "/sign-in/email-otp" ||
          ctx.path === "/email-otp/reset-password" ||
          ctx.path === "/email-otp/request-password-reset" ||
          ctx.path === "/forget-password/email-otp" ||
          (ctx.path === "/email-otp/send-verification-otp" &&
            ctx.body?.type !== "email-verification")
        )
          throw new APIError("FORBIDDEN", {
            message: "この認証方法は利用できません",
          });
      }),
    },
    plugins: [
      ...infrastructurePlugins(env, execution),
      expo(),
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        storeOTP: "hashed",
        disableSignUp: true,
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "email-verification") throw new APIError("FORBIDDEN");
          try {
            await sendAuthEmail(env, verificationEmail(email, otp));
          } catch (error) {
            verificationDeliveryError =
              error instanceof Error
                ? error
                : new Error("メール配信に失敗しました");
            throw error;
          }
        },
      }),
    ],
  });
}
