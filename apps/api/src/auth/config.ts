import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { sendAuthEmail, verificationEmail, resetEmail } from "./email";

export function socialProviders(env: Env) {
  return {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
      ? {
          apple: {
            clientId: env.APPLE_CLIENT_ID,
            clientSecret: env.APPLE_CLIENT_SECRET,
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
  return betterAuth({
    appName: "Flocka",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      ...env.ALLOWED_ORIGINS.split(","),
      "flocka://",
      ...(socialProviders(env).apple ? ["https://appleid.apple.com"] : []),
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
    user: {
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
    emailVerification: { autoSignInAfterVerification: true },
    socialProviders: socialProviders(env),
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 30,
      customRules: {
        "/sign-up/email": { window: 60, max: 5 },
        "/email-otp/send-verification-otp": { window: 30, max: 1 },
        "/email-otp/verify-email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
      },
    },
    hooks: {
      // Better Auth catches email callback failures. Surface them for the explicit resend request.
      after: createAuthMiddleware(async (ctx) => {
        if (
          ctx.path === "/email-otp/send-verification-otp" &&
          verificationDeliveryError
        )
          throw verificationDeliveryError;
      }),
      before: createAuthMiddleware(async (ctx) => {
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
