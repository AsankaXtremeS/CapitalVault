import { StyleSheet } from 'react-native';

const COLOR_MAP: Record<string, string> = {
  // Dark mode background -> Light mode background
  '#121214': '#FFFFFF',
  '#000000': '#FFFFFF',
  // Card surfaces
  '#1C1C1E': '#F2F2F7',
  // Borders/Separators
  '#2C2C2E': '#E5E5EA',
  // Secondary actions / buttons
  '#3A3A3C': '#E5E5EA',
  // Text color replacements
  '#FFFFFF': '#000000',
  '#ffffff': '#000000',
  // Muted text
  '#8E8E93': '#636366',
  '#636366': '#8E8E93',
};

/**
 * Dynamically resolves a static stylesheet to light mode or dark mode styles.
 * Returns the stylesheet as-is for dark mode, and maps background/text colors for light mode.
 */
export function getThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  staticStyles: T,
  isDark: boolean
): T {
  if (isDark) {
    return staticStyles;
  }

  // Create a deep copy and translate colors for light mode
  const themed: any = {};

  for (const key in staticStyles) {
    if (Object.prototype.hasOwnProperty.call(staticStyles, key)) {
      const styleObj = { ...(staticStyles[key] as any) };
      
      for (const prop in styleObj) {
        if (Object.prototype.hasOwnProperty.call(styleObj, prop)) {
          const val = styleObj[prop];
          
          if (typeof val === 'string') {
            const trimmedVal = val.trim();
            // Perform color replacements based on the map
            if (COLOR_MAP[trimmedVal]) {
              styleObj[prop] = COLOR_MAP[trimmedVal];
            } else if (COLOR_MAP[trimmedVal.toUpperCase()]) {
              styleObj[prop] = COLOR_MAP[trimmedVal.toUpperCase()];
            }
          }
        }
      }
      
      themed[key] = styleObj;
    }
  }

  return themed;
}
