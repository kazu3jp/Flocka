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
