import { z } from "zod";
import {
  apiErrorSchema,
  syncSchema,
  preferencesRecordSchema,
  settingsSchema,
  type Preferences,
  backupRecordSchema,
  inviteSchema,
  pendingModerationPageSchema,
  remoteExchangeSchema,
  remotePlayerSchema,
  remoteTestimonySchema,
  LEGAL_VERSION,
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
  accountId?: string;
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
          ...(this.auth.accountId
            ? { "X-Flocka-Account": this.auth.accountId }
            : {}),
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
  async getSnapshot() {
    const snapshot = await this.json("/v1/sync?page=0", syncSchema);
    let next = snapshot.nextPage;
    while (next !== null) {
      const page = await this.json(`/v1/sync?page=${next}`, syncSchema);
      if (page.nextPage !== null && page.nextPage <= next)
        throw new Error("同期ページが進みません");
      snapshot.peers.push(...page.peers);
      snapshot.exchanges.push(...page.exchanges);
      snapshot.inbox.push(...page.inbox);
      snapshot.sent.push(...page.sent);
      snapshot.blocked.push(...page.blocked);
      snapshot.requests.push(...page.requests);
      next = page.nextPage;
    }
    // Inserts during pagination can repeat rows. Merge by stable identifiers.
    snapshot.peers = [
      ...new Map(snapshot.peers.map((item) => [item.id, item])).values(),
    ];
    snapshot.exchanges = [
      ...new Map(snapshot.exchanges.map((item) => [item.id, item])).values(),
    ];
    snapshot.inbox = [
      ...new Map(snapshot.inbox.map((item) => [item.id, item])).values(),
    ];
    snapshot.sent = [
      ...new Map(snapshot.sent.map((item) => [item.id, item])).values(),
    ];
    snapshot.requests = [
      ...new Map(snapshot.requests.map((item) => [item.id, item])).values(),
    ];
    snapshot.blocked = [...new Set(snapshot.blocked)];
    snapshot.nextPage = null;
    return snapshot;
  }
  savePreferences(data: Preferences, revision: number) {
    return this.json("/v1/me/preferences", preferencesRecordSchema, "PUT", {
      data,
      revision,
    });
  }
  saveSettings(settings: z.infer<typeof settingsSchema>) {
    return this.json("/v1/me/settings", settingsSchema, "PUT", settings);
  }
  previewInvite(code: string) {
    return this.json("/v1/invites/preview", remotePlayerSchema, "POST", {
      code,
    });
  }
  getExchange(id: string) {
    return this.json(
      `/v1/exchanges/${encodeURIComponent(id)}`,
      remoteExchangeSchema,
    );
  }
  cancelExchange(id: string) {
    return this.json(
      `/v1/exchanges/${encodeURIComponent(id)}/cancel`,
      remoteExchangeSchema,
      "POST",
    );
  }
  changeVisibility(id: string, visibility: "private" | "public" | "hidden") {
    return this.json(
      `/v1/testimonies/${encodeURIComponent(id)}`,
      remoteTestimonySchema,
      "PATCH",
      { visibility },
    );
  }
  block(id: string) {
    return this.json("/v1/blocks", z.object({ blocked: z.boolean() }), "POST", {
      playerId: id,
    });
  }
  unblock(id: string) {
    return this.json(
      `/v1/blocks/${encodeURIComponent(id)}`,
      z.object({ blocked: z.boolean() }),
      "DELETE",
    );
  }
  requestModeration(
    pieceId: string,
    kind: "report" | "deletion",
    reason?: string,
  ) {
    return this.json(
      "/v1/moderation",
      z.object({ id: z.string().uuid() }),
      "POST",
      { pieceId, kind, reason },
    );
  }
  withdrawRequest(id: string) {
    return this.json(
      `/v1/moderation/${encodeURIComponent(id)}/withdraw`,
      z.object({ withdrawn: z.boolean() }),
      "POST",
    );
  }
  registerPushDevice(token: string, platform: "ios" | "android") {
    return this.json(
      "/v1/me/push-devices",
      z.object({ registered: z.boolean() }),
      "PUT",
      { token, platform },
    );
  }
  unregisterPushDevice(token: string) {
    return this.json(
      "/v1/me/push-devices",
      z.object({ registered: z.boolean() }),
      "DELETE",
      { token },
    );
  }
  pendingModeration(page = 0) {
    return this.json(
      `/v1/admin/moderation?page=${page}`,
      pendingModerationPageSchema,
    );
  }
  resolveModeration(
    id: string,
    status: "reviewed" | "removed" | "rejected",
    note: string,
  ) {
    return this.json(
      `/v1/admin/moderation/${encodeURIComponent(id)}/resolve`,
      z.object({ id: z.string().uuid(), status: z.string() }),
      "POST",
      { status, note },
    );
  }
  async publicTestimonies(id: string) {
    const items: z.infer<typeof remoteTestimonySchema>[] = [];
    let page: number | null = 0;
    while (page !== null) {
      const result: {
        items: z.infer<typeof remoteTestimonySchema>[];
        nextPage: number | null;
      } = await this.json(
        `/v1/players/${encodeURIComponent(id)}/public?page=${page}`,
        z.object({
          items: z.array(remoteTestimonySchema),
          nextPage: z.number().int().nonnegative().nullable(),
        }),
      );
      items.push(...result.items);
      page = result.nextPage;
    }
    return {
      items: [...new Map(items.map((item) => [item.id, item])).values()],
    };
  }
  async peerAvatar(id: string): Promise<string> {
    return this.image(
      await this.request(`/v1/players/${encodeURIComponent(id)}/avatar`),
    );
  }
  acceptTerms() {
    return this.json(
      "/v1/me/terms",
      z.object({
        accepted: z.literal(true),
        version: z.literal(LEGAL_VERSION),
      }),
      "POST",
      { accepted: true, version: LEGAL_VERSION },
    );
  }
  createAccount(profile: Profile, self: string[]) {
    const { photo: _photo, ...avatar } = profile.avatar;
    return this.json("/v1/accounts", remotePlayerSchema, "POST", {
      profile: { ...profile, avatar },
      self,
    });
  }
  getMe() {
    return this.json("/v1/me", remotePlayerSchema);
  }
  updateProfile(profile: Profile, self: string[]) {
    const { photo: _photo, ...avatar } = profile.avatar;
    return this.json("/v1/me", remotePlayerSchema, "PATCH", {
      profile: { ...profile, avatar },
      self,
    });
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
  getInviteStatus(code: string) {
    return this.json(
      "/v1/invites/status",
      z.object({
        expiresAt: z.string(),
        exchange: remoteExchangeSchema.nullable(),
      }),
      "POST",
      { code },
    );
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
    );
    return this.image(response);
  }
  private async image(response: Response): Promise<string> {
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return `data:${response.headers.get("Content-Type")};base64,${btoa(binary)}`;
  }
}
