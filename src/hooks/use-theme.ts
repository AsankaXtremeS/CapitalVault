/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useLocalStore } from '@/hooks/useLocalStore';

export function useTheme() {
  const themeSetting = useLocalStore((state) => state.theme);
  const theme = themeSetting || 'dark';

  return Colors[theme];
}
