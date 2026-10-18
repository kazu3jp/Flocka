import { setStringAsync } from "expo-clipboard";

export async function copyText(text: string): Promise<void> {
  const copied = await setStringAsync(text);
  if (!copied) throw new Error("コピーできませんでした");
}
