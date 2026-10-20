import { ApiClientError } from "@flocka/api-client";

export const OFFLINE_MESSAGE =
  "通信できませんでした。通信環境を確認して、もう一度お試しください";

/**
 * The API client already turns server and network failures into fixed Japanese copy.
 * Any other error comes from a device library, so its raw text is replaced by the caller's copy.
 */
export function userFacingError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  // fetch reports an unreachable network as a bare TypeError on every platform.
  if (error instanceof TypeError && /network|fetch/i.test(error.message))
    return OFFLINE_MESSAGE;
  return fallback;
}
