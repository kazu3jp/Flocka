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
  type ModerationCursor,
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
/**
 * Errors that mean the signed-in session no longer matches the server:
 * signed out or switched elsewhere, or the account is being deleted.
 */
export function sessionFailureKind(
  error: unknown,
): "signed-out" | "account-deleting" | null {
  if (!(error instanceof ApiClientError)) return null;
  if (error.code === "ACCOUNT_DELETION_PENDING") return "account-deleting";
  if (
    error.status === 401 &&
    (error.code === "UNAUTHORIZED" || error.code === "ACCOUNT_CHANGED")
  )
    return "signed-out";
  return null;
}
export type SessionTransport = {
  accountId?: string;
  /** Told about every session failure so the app can re-check who is signed in. */
  onSessionFailure?: (error: ApiClientError) => void;
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
  private invalidResponse(status: number) {
    return new ApiClientError(
      status,
      "INVALID_RESPONSE",
      "APIの応答を読み込めませんでした。もう一度お試しください",
    );
  }
  private async responseJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch (error) {
      if (error instanceof SyntaxError)
        throw this.invalidResponse(response.status);
      throw error;
    }
  }
  private async parseResponse<T>(
    response: Response,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const parsed = schema.safeParse(await this.responseJson(response));
    if (!parsed.success) throw this.invalidResponse(response.status);
    return parsed.data;
  }
  private async request<T>(
    path: string,
    consume: (response: Response) => Promise<T>,
    method = "GET",
    body?: unknown,
    contentType = "application/json",
  ): Promise<T> {
    let payload: BodyInit | undefined;
    if (body !== undefined) {
      if (contentType === "application/json") payload = JSON.stringify(body);
      else if (body instanceof Uint8Array)
        payload = new Uint8Array(body).buffer;
      else throw new Error("画像の送信データが不正です");
    }
    const controller = new AbortController();
    const timeoutError = () =>
      new ApiClientError(0, "TIMEOUT", "APIへの接続がタイムアウトしました");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(timeoutError());
      }, 15_000);
    });
    const operation = async () => {
      let cookie: string | undefined;
      if (this.auth.cookie) {
        try {
          cookie = await this.auth.cookie();
        } catch (error) {
          if (error instanceof ApiClientError) throw error;
          throw new ApiClientError(
            0,
            "AUTH_STORAGE",
            "認証情報を読み込めませんでした。もう一度お試しください",
          );
        }
      }
      // A late credential read must not start a request after its deadline.
      if (controller.signal.aborted) throw timeoutError();
      const response = await fetch(this.baseUrl + path, {
        method,
        signal: controller.signal,
        credentials: this.auth.credentials ?? "include",
        headers: {
          ...(this.auth.accountId
            ? { "X-Flocka-Account": this.auth.accountId }
            : {}),
          ...(cookie !== undefined ? { Cookie: cookie } : {}),
          ...(body !== undefined ? { "Content-Type": contentType } : {}),
        },
        body: payload,
      });
      if (!response.ok) {
        const parsed = apiErrorSchema.safeParse(
          await this.responseJson(response),
        );
        if (!parsed.success) throw this.invalidResponse(response.status);
        const message =
          parsed.data.error.code === "INVALID_INPUT"
            ? "入力内容を確認して、もう一度お試しください"
            : ["INVALID_JSON", "JSON_REQUIRED"].includes(parsed.data.error.code)
              ? "送信内容を確認できませんでした。もう一度お試しください"
              : parsed.data.error.message;
        const failure = new ApiClientError(
          response.status,
          parsed.data.error.code,
          message,
        );
        if (sessionFailureKind(failure)) this.auth.onSessionFailure?.(failure);
        throw failure;
      }
      // Keep the deadline active until JSON or image data has been consumed.
      return consume(response);
    };
    try {
      return await Promise.race([operation(), deadline]);
    } catch (error) {
      const timedOut = controller.signal.aborted;
      controller.abort();
      if (timedOut) throw timeoutError();
      if (error instanceof TypeError)
        throw new ApiClientError(
          0,
          "NETWORK_ERROR",
          "APIに接続できません。接続先と通信環境を確認してください",
        );
      throw error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  private json<T>(
    path: string,
    schema: z.ZodType<T>,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    return this.request(
      path,
      (response) => this.parseResponse(response, schema),
      method,
      body,
    );
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
      remoteExchangeSchema.extend({ status: z.literal("cancelled") }),
      "POST",
    );
  }
  changeVisibility(
    id: string,
    visibility: "private" | "public" | "hidden",
    expectedVisibilityRevision?: number,
  ) {
    return this.json(
      `/v1/testimonies/${encodeURIComponent(id)}`,
      remoteTestimonySchema,
      "PATCH",
      { visibility, expectedVisibilityRevision },
    );
  }
  block(id: string) {
    return this.json(
      "/v1/blocks",
      z.object({
        blocked: z.literal(true),
        undoToken: z.string().min(1).max(100).nullable(),
      }),
      "POST",
      { playerId: id },
    );
  }
  unblock(id: string, undoToken?: string) {
    const query =
      undoToken === undefined
        ? ""
        : `?undoToken=${encodeURIComponent(undoToken)}`;
    return this.json(
      `/v1/blocks/${encodeURIComponent(id)}${query}`,
      z.object({ blocked: z.literal(false) }),
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
      z.object({ withdrawn: z.literal(true) }),
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
  pendingModeration(after: ModerationCursor | null = null) {
    const query = after
      ? `?${new URLSearchParams({ afterAt: after.at, afterId: after.id })}`
      : "";
    return this.json(
      `/v1/admin/moderation${query}`,
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
      // A repeated or earlier page would loop forever on a misbehaving server.
      if (result.nextPage !== null && result.nextPage <= page)
        throw new ApiClientError(
          0,
          "PAGINATION_STALLED",
          "証言の一覧を読み込めませんでした。もう一度お試しください",
        );
      items.push(...result.items);
      page = result.nextPage;
    }
    return {
      items: [...new Map(items.map((item) => [item.id, item])).values()],
    };
  }
  async peerAvatar(id: string): Promise<string> {
    return this.request(
      `/v1/players/${encodeURIComponent(id)}/avatar`,
      (response) => this.image(response),
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
    const result = await this.request(
      "/v1/me/avatar",
      (response) =>
        this.parseResponse(response, z.object({ avatarKey: z.string() })),
      "PUT",
      bytes,
      match[1],
    );
    return result.avatarKey;
  }
  getAvatar(backup = false): Promise<string> {
    return this.request(
      backup ? "/v1/me/backup/avatar" : "/v1/me/avatar",
      (response) => this.image(response),
    );
  }
  private async image(response: Response): Promise<string> {
    const mime = response.headers
      .get("Content-Type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (mime !== "image/jpeg" && mime !== "image/png")
      throw this.invalidResponse(response.status);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const valid =
      mime === "image/jpeg"
        ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : [137, 80, 78, 71, 13, 10, 26, 10].every(
            (value, index) => bytes[index] === value,
          );
    if (!valid) throw this.invalidResponse(response.status);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return `data:${mime};base64,${btoa(binary)}`;
  }
}
