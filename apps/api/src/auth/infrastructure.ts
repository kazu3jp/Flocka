import { dash, sentinel } from "@better-auth/infra";

export const DASHBOARD_ORIGIN = "https://dash.better-auth.com";

export function infrastructurePlugins(
  env: Pick<Env, "BETTER_AUTH_API_KEY">,
  execution?: Pick<ExecutionContext, "waitUntil">,
) {
  const apiKey = env.BETTER_AUTH_API_KEY?.trim();
  // No dashboard endpoints or external tracking until explicitly configured.
  if (!apiKey) return [];
  return [
    dash({ apiKey }),
    sentinel({ apiKey }),
    ...(execution
      ? [
          {
            id: "workers-infrastructure-events",
            init() {
              return {
                context: {
                  // Only explicitly backgrounded analytics use waitUntil.
                  // Do not background runInBackgroundOrAwait: email delivery
                  // must finish before its result is reported to the client.
                  runInBackground: (task: Promise<unknown>) =>
                    execution.waitUntil(task),
                },
              };
            },
          },
        ]
      : []),
  ];
}

export function isDashboardRequest(
  env: Pick<Env, "BETTER_AUTH_API_KEY">,
  path: string,
  origin: string,
) {
  return Boolean(
    env.BETTER_AUTH_API_KEY?.trim() &&
    origin === DASHBOARD_ORIGIN &&
    path.startsWith("/api/auth/dash/"),
  );
}
