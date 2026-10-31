import type { PRAiOutputRejection } from "./pr-ai-output";
import type { PRAiMessage } from "./pr-ai-prompt";

/** Why a draft was refused: the validator's reason, or the verifier's verdict. */
export type PRAiRefusal =
  | { reason: PRAiOutputRejection; terms?: string[] }
  | { reason: "ungrounded-claim"; sentences: string[] };

const REPAIRS: Record<PRAiRefusal["reason"], (refusal: PRAiRefusal) => string> =
  {
    empty: () => "回答が空でした。",
    "invalid-structure": () =>
      "回答が指定の形式ではありませんでした。claims は1〜4件、全体で別々の証言を2件以上使い、各文に sourceIndexes を付けてください。",
    "unknown-source": () =>
      "存在しない証言番号を使っています。<testimonies> にある番号だけを使ってください。",
    "unknown-strength": () => "確認済みの強みについて書いてください。",
    "quotation-marks": () =>
      "「」や『』で証言を引用しないでください。証言の内容を、本人の言葉として自然に言い換えてください。",
    "giver-perspective": () =>
      "「〜してくれた」は仲間から見た言い方です。本人の行動として「〜しました」「〜できます」のように書いてください。",
    "names-strength": () =>
      "強みの名前をそのまま書かないでください。証言に書かれている具体的な言葉で表してください。",
    "fabricated-number": () =>
      "証言にない数字を書かないでください。証言番号も sentence には書かず、sourceIndexes にだけ書いてください。",
    "unsupported-term": (refusal) =>
      `次の語は、その文が根拠にした証言にないため使えません: ${"terms" in refusal ? (refusal.terms ?? []).join("、") : ""}。これらを使わずに書き直してください。`,
    "forbidden-format": () =>
      "見出し、箇条書き、Markdown、HTML、URLを使わないでください。",
    "too-long": () => "長すぎます。300文字以内に短くしてください。",
    "ungrounded-claim": (refusal) =>
      `次の文は、引用した証言だけでは裏づけられません: ${"sentences" in refusal ? refusal.sentences.map((sentence) => `「${sentence}」`).join("、") : ""}。証言にない評価や結論を足さず、証言の言葉に沿って書き直してください。`,
  };

/**
 * One follow-up turn that names exactly what was refused. The refused answer
 * goes back as the assistant turn so the model edits it instead of starting over.
 */
export function buildPRAiRepairMessages(
  messages: PRAiMessage[],
  refused: string,
  refusal: PRAiRefusal,
): PRAiMessage[] {
  return [
    ...messages,
    { role: "assistant", content: refused.trim() || "（回答なし）" },
    {
      role: "user",
      content: `${REPAIRS[refusal.reason](refusal)}\n前の回答を直して、同じ形式のJSONオブジェクトだけを出力してください。`,
    },
  ];
}
