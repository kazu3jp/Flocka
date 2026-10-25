import type { RequestRecord } from "@flocka/domain";

/** The three receiving switches. `hint` says in one line what the switch changes. */
export const RECEIVING_SWITCHES = [
  {
    key: "allowVibe",
    label: "印象を受け取る",
    hint: "「印象」の証言を受け取ります。",
  },
  {
    key: "allowProof",
    label: "場面のメモを受け取る",
    hint: "「場面のメモ」の証言を受け取ります。",
  },
  {
    key: "onlyConnected",
    label: "交換した人からだけ",
    hint: "交換が成立した人の証言だけ届きます。",
  },
] as const;

export type ReceivingKey = (typeof RECEIVING_SWITCHES)[number]["key"];
export type ReceivingSettings = Record<ReceivingKey, boolean>;

export type VisibilityLine = {
  key: "vibe" | "proof" | "sender" | "profile" | "blocked";
  label: string;
  value: string;
};

/**
 * Who can see or send what right now. Computed from the saved settings only,
 * so it never claims more than the server enforces. Testimonies can only be
 * sent after an accepted exchange whatever `onlyConnected` says, and SNS links
 * are shown to exchanged peers only (never publicly), so those two lines do
 * not depend on a switch.
 */
export function describeVisibility({
  settings,
  snsLinkCount,
  blockedCount,
}: {
  settings: ReceivingSettings;
  snsLinkCount: number;
  blockedCount: number;
}): VisibilityLine[] {
  return [
    {
      key: "sender",
      label: "証言を贈れる人",
      value: "交換が成立した人だけ",
    },
    {
      key: "vibe",
      label: "印象",
      value: settings.allowVibe ? "受け取る" : "受け取らない",
    },
    {
      key: "proof",
      label: "場面のメモ",
      value: settings.allowProof ? "受け取る" : "受け取らない",
    },
    {
      key: "profile",
      label: "プロフィール・SNS",
      value:
        snsLinkCount > 0
          ? `交換した人にだけ見えます（SNS ${snsLinkCount}件）`
          : "交換した人にだけ見えます（SNS未登録）",
    },
    {
      key: "blocked",
      label: "ブロック中の人",
      value:
        blockedCount > 0
          ? `${blockedCount}人（お互いに見えません）`
          : "いません",
    },
  ];
}

export function hasUnsavedSettings(
  saved: ReceivingSettings,
  edited: ReceivingSettings,
): boolean {
  return RECEIVING_SWITCHES.some(({ key }) => saved[key] !== edited[key]);
}

export function requestStatusLabel(record: RequestRecord): string {
  if (record.withdrawn) return "取り下げ済み";
  switch (record.status) {
    case "pending":
      return "受付済み";
    case "removed":
      return "削除済み";
    case "rejected":
      return "対応なし";
    default:
      return "確認済み";
  }
}

export function canWithdrawRequest(record: RequestRecord): boolean {
  return !record.withdrawn && record.status === "pending";
}
