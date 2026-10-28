import { getStringAsync } from "expo-clipboard";

/** The clipboard's text; an empty clipboard or a refused read is an error, not "". */
export async function pasteText(): Promise<string> {
  let text: string;
  try {
    text = await getStringAsync();
  } catch {
    throw new Error("クリップボードを読み取れませんでした");
  }
  if (!text.trim()) throw new Error("クリップボードに文字がありません");
  return text;
}
