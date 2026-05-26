import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Calculator, X, ChevronRight, CornerDownLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUBBLE_SIZE = 60;
const CALC_WIDTH = 260;
const CALC_HEIGHT = 360;

interface FloatingCalculatorProps {
  onInsert: (value: string) => void;
}

export default function FloatingCalculator({ onInsert }: FloatingCalculatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('0');

  // Shared values for animated dragging coordinates
  const translateX = useSharedValue(SCREEN_WIDTH - BUBBLE_SIZE - 20);
  const translateY = useSharedValue(120);

  // Gesture handler to control Pan dragging
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startX = translateX.value;
      ctx.startY = translateY.value;
    },
    onActive: (event, ctx) => {
      translateX.value = ctx.startX + event.translationX;
      translateY.value = ctx.startY + event.translationY;
    },
    onEnd: (event) => {
      // Snap to closest horizontal edge (left or right side of screen)
      const snapLeft = 20;
      const snapRight = SCREEN_WIDTH - BUBBLE_SIZE - 20;
      
      const snapX = translateX.value + event.velocityX * 0.1 < SCREEN_WIDTH / 2 ? snapLeft : snapRight;
      translateX.value = withSpring(snapX, { damping: 15 });

      // Clamp vertical bounds to keep bubble fully visible
      const minY = 50;
      const maxY = SCREEN_HEIGHT - BUBBLE_SIZE - 80;
      if (translateY.value < minY) {
        translateY.value = withSpring(minY);
      } else if (translateY.value > maxY) {
        translateY.value = withSpring(maxY);
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

  const toggleCalculator = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpen(!isOpen);
  };

  const handleKeyPress = (val: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (val === 'C') {
      setExpression('');
      setResult('0');
      return;
    }

    if (val === '=') {
      try {
        // Sanitize and safely calculate standard arithmetic
        const sanitized = expression.replace(/x/g, '*').replace(/÷/g, '/');
        // Simple evaluator using standard math logic (safe bounds checks)
        if (!/^[0-9+\-*/().\s]+$/.test(sanitized)) {
          throw new Error('Invalid Math Characters');
        }
        
        // Use Function instead of eval for safer compilation sandboxing
        const evalResult = new Function(`return (${sanitized})`)();
        if (evalResult === undefined || isNaN(evalResult) || !isFinite(evalResult)) {
          setResult('Error');
        } else {
          const finalVal = Number(evalResult.toFixed(2)).toString();
          setResult(finalVal);
          setExpression(finalVal);
        }
      } catch (err) {
        setResult('Error');
      }
      return;
    }

    // Standard operator append
    setExpression((prev) => prev + val);
  };

  const handleInsert = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onInsert(result);
    setIsOpen(false);
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {!isOpen ? (
        // Draggable Floating Bubble
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={toggleCalculator}
              style={styles.bubble}
            >
              <Calculator color="#FFFFFF" size={26} />
            </TouchableOpacity>
          </Animated.View>
        </PanGestureHandler>
      ) : (
        // Expanded Glassmorphism Calculator panel
        <View style={styles.calcPanel}>
          {/* Header Controls */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>In-App Calculator</Text>
            <TouchableOpacity onPress={toggleCalculator} style={styles.closeBtn}>
              <X color="#8E8E93" size={18} />
            </TouchableOpacity>
          </View>

          {/* Screen Output Display */}
          <View style={styles.displayContainer}>
            <Text numberOfLines={1} style={styles.expressionText}>
              {expression || '0'}
            </Text>
            <Text numberOfLines={1} style={styles.resultText}>
              {result}
            </Text>
          </View>

          {/* Keys Matrix Grid */}
          <View style={styles.keysGrid}>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => handleKeyPress('C')} style={[styles.key, styles.keyAction]}>
                <Text style={styles.keyTextAction}>C</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleKeyPress('(')} style={[styles.key, styles.keyAction]}>
                <Text style={styles.keyTextAction}>(</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleKeyPress(')')} style={[styles.key, styles.keyAction]}>
                <Text style={styles.keyTextAction}>)</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleKeyPress('÷')} style={[styles.key, styles.keyOperator]}>
                <Text style={styles.keyTextOperator}>÷</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <TouchableOpacity onPress={() => handleKeyPress('7')} style={styles.key}>
                <Text style={styles.keyText}>7</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleKeyPress('8')} style={styles.key}>
                <Text style={styles.keyText}>8</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleKeyPress('9')} style={styles.key}>
                <Text style={styles.keyText}>9</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleKeyPress('x')} style={[styles.key, styles.keyOperator]}>
                <Text style={styles.keyTextOperator}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <TouchableOpacity onPress={() => handleKeyPress('4')} style={styles.key}>
                <Text style={styles.keyText}>4</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleKeyPress('5')} style={styles.key}>
                <Text style={styles.keyText}>5</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleKeyPress('6')} style={styles.key}>
                <Text style={styles.keyText}>6</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleKeyPress('-')} style={[styles.key, styles.keyOperator]}>
                <Text style={styles.keyTextOperator}>-</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <TouchableOpacity onPress={() => handleKeyPress('1')} style={styles.key}>
                <Text style={styles.keyText}>1</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleKeyPress('2')} style={styles.key}>
                <Text style={styles.keyText}>2</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleKeyPress('3')} style={styles.key}>
                <Text style={styles.keyText}>3</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleKeyPress('+')} style={[styles.key, styles.keyOperator]}>
                <Text style={styles.keyTextOperator}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <TouchableOpacity onPress={() => handleKeyPress('0')} style={[styles.key, styles.keyZero]}>
                <Text style={styles.keyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleKeyPress('.')} style={styles.key}>
                <Text style={styles.keyText}>.</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleKeyPress('=')} style={[styles.key, styles.keyEquals]}>
                <Text style={styles.keyTextEquals}>=</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Insert PIP Button */}
          <TouchableOpacity onPress={handleInsert} style={styles.insertBtn}>
            <CornerDownLeft color="#FFFFFF" size={16} />
            <Text style={styles.insertBtnText}>Insert Calculation</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 9999,
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: '#AF52DE', // Royal Purple contrast accent
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#C382E6',
  },
  calcPanel: {
    width: CALC_WIDTH,
    height: CALC_HEIGHT,
    borderRadius: 20,
    backgroundColor: '#1C1C1E', // Sleek slate container
    borderWidth: 1.5,
    borderColor: '#2C2C2E',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 12,
    // Negative offset adjustment to expand relative to bubble drag anchors
    marginLeft: -CALC_WIDTH + BUBBLE_SIZE,
    marginTop: -20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  displayContainer: {
    backgroundColor: '#121214',
    borderRadius: 10,
    padding: 8,
    alignItems: 'flex-end',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1C1C1E',
  },
  expressionText: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 2,
  },
  resultText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  keysGrid: {
    flex: 1,
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  key: {
    width: 48,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyZero: {
    width: 104, // spans two spaces
  },
  keyAction: {
    backgroundColor: '#3A3A3C',
  },
  keyOperator: {
    backgroundColor: '#AF52DE', // Purple accent
  },
  keyEquals: {
    backgroundColor: '#0A84FF', // Electric blue accent
  },
  keyText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  keyTextAction: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  keyTextOperator: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  keyTextEquals: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  insertBtn: {
    backgroundColor: '#0A84FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    height: 36,
    marginTop: 8,
  },
  insertBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
});
