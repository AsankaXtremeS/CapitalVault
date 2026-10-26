import * as ExpoHaptics from "expo-haptics";
import { useLocalStore } from "@/hooks/useLocalStore";

// Drop-in replacement for `expo-haptics` that honours the "Haptic Feedback" setting.
export { ImpactFeedbackStyle, NotificationFeedbackType } from "expo-haptics";

const isEnabled = () => useLocalStore.getState().hapticsEnabled;

export function impactAsync(style?: ExpoHaptics.ImpactFeedbackStyle) {
  if (!isEnabled()) return Promise.resolve();
  return ExpoHaptics.impactAsync(style).catch(() => {});
}

export function notificationAsync(type?: ExpoHaptics.NotificationFeedbackType) {
  if (!isEnabled()) return Promise.resolve();
  return ExpoHaptics.notificationAsync(type).catch(() => {});
}
