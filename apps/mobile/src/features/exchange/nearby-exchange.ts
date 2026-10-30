import { UserFacingError } from "../sync/user-facing-error";
import type { RemoteExchange } from "@flocka/domain";

export type NearbyExchangeSignal = { code: string; exchangeId: string };

type Dependencies = {
  create: (code: string) => Promise<RemoteExchange>;
  notify: (code: string, exchangeId: string) => Promise<void>;
  notificationFailed: () => void;
  get: (id: string) => Promise<RemoteExchange>;
  peerId: (code: string) => Promise<string>;
  refresh: () => Promise<void>;
  open: (id: string) => void;
};

/** Server writes are authoritative; BLE only wakes a peer's authenticated read. */
export function createNearbyExchange(deps: Dependencies) {
  let active = true;
  let opened = false;
  let work: Promise<unknown> = Promise.resolve();
  const queue = <T>(operation: () => Promise<T>) => {
    const next = work.then(operation);
    work = next.catch(() => {});
    return next;
  };
  const available = () => active && !opened;
  const open = async (exchange: RemoteExchange) => {
    if (!available()) return;
    await deps.refresh();
    if (!available()) return;
    opened = true;
    deps.open(exchange.id);
  };
  return {
    start: (code: string) =>
      queue(async () => {
        if (!available()) return;
        const exchange = await deps.create(code);
        if (!available()) return;
        if (exchange.status === "cancelled")
          throw new UserFacingError("この交換はキャンセルされています");
        try {
          await deps.notify(code, exchange.id);
        } catch {
          // The exchange is saved. Report the missing BLE acknowledgement;
          // the peer's normal invite-status polling can still discover it.
          if (available()) deps.notificationFailed();
        }
        await open(exchange);
      }),
    receive: (signal: NearbyExchangeSignal) =>
      queue(async () => {
        if (!available()) return;
        const expectedPeer = await deps.peerId(signal.code);
        if (!available()) return;
        const exchange = await deps.get(signal.exchangeId);
        if (!available()) return;
        if (
          exchange.id !== signal.exchangeId ||
          exchange.peer.id !== expectedPeer ||
          exchange.status === "cancelled"
        )
          throw new UserFacingError("相手との交換情報を確認できませんでした");
        await open(exchange);
      }),
    dispose: () => {
      active = false;
    },
  };
}
