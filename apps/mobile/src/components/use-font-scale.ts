import { useWindowDimensions } from "react-native";

/** The system font scale, 1 where the platform has none (the web). */
export function useFontScale() {
  return useWindowDimensions().fontScale;
}
