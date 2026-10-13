import { Platform } from "react-native";
import { getItemAsync, setItemAsync } from "expo-secure-store";
import { z } from "zod";

const SESSION_KEY = "flocka-backend-session-v1";
const storedSessionSchema = z.object({
  apiUrl: z.string(),
  token: z.string().length(43),
});
export async function readSession(apiUrl: string): Promise<string | null> {
  const raw =
    Platform.OS === "web"
      ? window.sessionStorage.getItem(SESSION_KEY)
      : await getItemAsync(SESSION_KEY);
  if (raw === null) return null;
  const stored = storedSessionSchema.parse(JSON.parse(raw));
  if (stored.apiUrl !== apiUrl)
    throw new Error("保存されたセッションのAPI接続先が異なります");
  return stored.token;
}
export async function saveSession(
  apiUrl: string,
  token: string,
): Promise<void> {
  const raw = JSON.stringify({ apiUrl, token });
  if (Platform.OS === "web") window.sessionStorage.setItem(SESSION_KEY, raw);
  else await setItemAsync(SESSION_KEY, raw);
}
