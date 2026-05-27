import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { useNavigation } from "expo-router";
import { useTheme } from "@/hooks/use-theme";

interface AnimatedScreenWrapperProps {
  children: React.ReactNode;
}

export default function AnimatedScreenWrapper({ children }: AnimatedScreenWrapperProps) {
  const navigation = useNavigation();
  const [isFocused, setIsFocused] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0.95)).current; // Snappy micro-fade (95% -> 100%) with NO scale changes
  const theme = useTheme();

  useEffect(() => {
    // Subscribe to focus/blur events
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsFocused(true);
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsFocused(false);
    });

    // Check current focus state in case it's already focused on mount
    setIsFocused(navigation.isFocused());

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation]);

  useEffect(() => {
    if (isFocused) {
      fadeAnim.setValue(0.95);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150, // Snappy 150ms transition
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0.95);
    }
  }, [isFocused]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          backgroundColor: theme.background,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
