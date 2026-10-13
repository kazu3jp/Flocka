import { z } from "zod";
import {
  apiErrorSchema,
  backupRecordSchema,
  inviteSchema,
  remoteExchangeSchema,
  remotePlayerSchema,
  remoteTestimonySchema,
  type Profile,
  type State,
} from "@flocka/domain";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export type SessionTransport = {
  cookie?: () => string | Promise<string>;
  credentials?: RequestCredentials;
};
export class FlockaApiClient {
  private readonly baseUrl: string;
  constructor(
    baseUrl: string,
    private readonly auth: SessionTransport = {},
    private readonly allowHttp = false,
  ) {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:"))
      throw new Error("APIにはHTTPSを指定してください");
    if (url.username || url.password || url.search || url.hash)
      throw new Error("APIのURLに認証情報やクエリは指定できません");
    this.baseUrl = url.href.replace(/\/$/, "");
  }
  private async request(
    path: string,
    method = "GET",
    body?: unknown,
    contentType = "application/json",
  ): Promise<Response> {
    let payload: BodyInit | undefined;
    if (body !== undefined) {
      if (contentType === "application/json") payload = JSON.stringify(body);
      else if (body instanceof Uint8Array)
        payload = new Uint8Array(body).buffer;
      else throw new Error("画像の送信データが不正です");
    }
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(this.baseUrl + path, {
        method,
        signal: controller.signal,
        credentials: this.auth.credentials ?? "include",
        headers: {
          ...(this.auth.cookie ? { Cookie: await this.auth.cookie() } : {}),
          ...(body !== undefined ? { "Content-Type": contentType } : {}),
        },
        body: payload,
      });
      if (!response.ok) {
        const parsed = apiErrorSchema.safeParse(await response.json());
        if (parsed.success)
          throw new ApiClientError(
            response.status,
            parsed.data.error.code,
            parsed.data.error.message,
          );
        throw new ApiClientError(
          response.status,
          "INVALID_RESPONSE",
          "APIの応答を読み込めませんでした",
        );
      }
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError")
        throw new ApiClientError(
          0,
          "TIMEOUT",
          "APIへの接続がタイムアウトしました",
        );
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  private async json<T>(
    path: string,
    schema: z.ZodType<T>,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    return schema.parse(await (await this.request(path, method, body)).json());
  }
  createAccount(profile: Profile, self: string[]) {
    return this.json("/v1/accounts", remotePlayerSchema, "POST", {
      profile,
      self,
    });
  }
  getMe() {
    return this.json("/v1/me", remotePlayerSchema);
  }
  updateProfile(profile: Profile, self: string[]) {
    return this.json("/v1/me", remotePlayerSchema, "PATCH", { profile, self });
  }
  getBackup() {
    return this.json("/v1/me/backup", backupRecordSchema);
  }
  saveBackup(
    snapshot: State,
    revision: number | null,
    avatarKey: string | null = null,
  ) {
    return this.json("/v1/me/backup", backupRecordSchema, "PUT", {
      snapshot,
      revision,
      avatarKey,
    });
  }
  createInvite() {
    return this.json("/v1/invites", inviteSchema, "POST");
  }
  startExchange(code: string) {
    return this.json("/v1/exchanges", remoteExchangeSchema, "POST", { code });
  }
  getExchanges() {
    return this.json(
      "/v1/exchanges",
      z.object({ items: z.array(remoteExchangeSchema) }),
    );
  }
  approveExchange(id: string, place: string, trigger: string) {
    return this.json(
      `/v1/exchanges/${encodeURIComponent(id)}/approve`,
      remoteExchangeSchema,
      "POST",
      { place, trigger },
    );
  }
  sendImpression(
    exchangeId: string,
    card: string,
    label: string,
    text: string,
  ) {
    return this.json(
      "/v1/testimonies",
      z.object({ id: z.string().uuid() }),
      "POST",
      { exchangeId, kind: "vibe", card, label, text },
    );
  }
  sendScene(exchangeId: string, card: string, story: string) {
    return this.json(
      "/v1/testimonies",
      z.object({ id: z.string().uuid() }),
      "POST",
      { exchangeId, kind: "proof", card, story },
    );
  }
  getTestimonies() {
    return this.json(
      "/v1/testimonies",
      z.object({ items: z.array(remoteTestimonySchema) }),
    );
  }
  openTestimony(id: string, guess: string) {
    return this.json(
      `/v1/testimonies/${encodeURIComponent(id)}`,
      remoteTestimonySchema,
      "PATCH",
      { opened: true, guess },
    );
  }
  async uploadAvatar(photo: string): Promise<string> {
    const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(
      photo,
    );
    if (!match) throw new Error("JPEGまたはPNGの写真を指定してください");
    const binary = atob(match[2]),
      bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const response = await this.request(
      "/v1/me/avatar",
      "PUT",
      bytes,
      match[1],
    );
    return z.object({ avatarKey: z.string() }).parse(await response.json())
      .avatarKey;
  }
  async getAvatar(backup = false): Promise<string> {
    const response = await this.request(
        backup ? "/v1/me/backup/avatar" : "/v1/me/avatar",
      ),
      bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return `data:${response.headers.get("Content-Type")};base64,${btoa(binary)}`;
  }
}
