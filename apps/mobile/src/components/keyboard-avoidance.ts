import { Platform } from "react-native";

// Android apps are edge-to-edge, so the window no longer resizes for the keyboard.
// The view measures its own overlap with the keyboard, so a resized window adds no offset.
export const keyboardAvoidance = Platform.OS === "ios" ? "padding" : "height";
