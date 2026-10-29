import type { Piece, RequestRecord } from "@flocka/domain";

/** What each visibility of a received testimony means, as shown wherever it is chosen. */
export const VISIBILITY_CHOICES: readonly [
  Piece["visibility"],
  string,
  string,
][] = [
  [
    "private",
    "本人だけ",
    "あなただけが見られます。デッキと自己PRには使われます。",
  ],
  [
    "public",
    "個別公開",
    "交換した相手が、あなたのプロフィールから見られます。送った人の名前は出ません。",
  ],
  [
    "hidden",
    "非表示",
    "誰にも見えず、デッキと自己PRにも使われません。「届いた証言」から戻せます。",
  ],
];

/** The three receiving switches. `hint` says in one line what the switch changes. */
export const RECEIVING_SWITCHES = [
  {
    key: "allowVibe",
    label: "第一印象を受け取る",
    hint: "交換した相手からの、1人1回の第一印象を受け取ります。",
  },
  {
    key: "allowProof",
    label: "エピソードを受け取る",
    hint: "見た場面を書いた証言を、何度でも受け取ります。",
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
