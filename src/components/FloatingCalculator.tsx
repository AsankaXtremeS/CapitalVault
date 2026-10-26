import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Animated, PanResponder } from 'react-native';
import { Calculator, X, CornerDownLeft } from "@/components/icons";
import * as Haptics from "@/utils/haptics";
import { useLocalStore } from '@/hooks/useLocalStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUBBLE_SIZE = 60;
const CALC_WIDTH = 280;
const CALC_HEIGHT = 420; // Increased to 420px to prevent overlap and support larger, premium key touch targets

interface FloatingCalculatorProps {
  onInsert: (value: string) => void;
}

// Drag/snap behaviour for the bubble and the open panel. Lives outside React so the
// gesture callbacks can keep mutable coordinates without touching refs during render.
function createCalculatorGesture() {
  // Align initial coordinates perfectly floating directly above the main FAB button
  const initialX = SCREEN_WIDTH - BUBBLE_SIZE - 24;
  const initialY = SCREEN_HEIGHT - BUBBLE_SIZE - 160; // Perfectly calculated: tab bar (64) + FAB bottom (24) + FAB height (60) + gap (12)

  // Current panel/bubble coordinates, and the bubble's resting spot to return to on close
  let position = { x: initialX, y: initialY };
  let snapped = { x: initialX, y: initialY };
  const pan = new Animated.ValueXY({ x: initialX, y: initialY });

  const springTo = (target: { x: number; y: number }, friction: number, tension: number) => {
    position = { ...target };
    Animated.spring(pan, { toValue: target, useNativeDriver: false, friction, tension }).start();
  };

  // React Native PanResponder for seamless dragging anywhere on the screen
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onPanResponderMove: (_e, gestureState) => {
      // Apply relative drag translations
      pan.setValue({
        x: position.x + gestureState.dx,
        y: position.y + gestureState.dy,
      });
    },
    onPanResponderRelease: (_e, gestureState) => {
      const currentX = position.x + gestureState.dx;
      const currentY = position.y + gestureState.dy;

      if (!useLocalStore.getState().isCalculatorOpen) {
        // Detect a clean tap (minimal finger movement)
        const distance = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
        if (distance < 8) {
          useLocalStore.getState().openCalculator();
          return;
        }

        // Snap logic to closest vertical border
        const isLeft = currentX < SCREEN_WIDTH / 2 - BUBBLE_SIZE / 2;
        const snapX = isLeft ? 20 : SCREEN_WIDTH - BUBBLE_SIZE - 24;

        // Prevent overlapping with the Add FAB button on the right side
        const maxY = isLeft
          ? SCREEN_HEIGHT - BUBBLE_SIZE - 80
          : SCREEN_HEIGHT - BUBBLE_SIZE - 160; // Keep space for the FAB and gap on the right

        snapped = { x: snapX, y: Math.max(60, Math.min(maxY, currentY)) };
        springTo(snapped, 6, 40);
      } else {
        // Keep the open panel fully inside screen boundaries
        springTo(
          {
            x: Math.max(10, Math.min(SCREEN_WIDTH - CALC_WIDTH - 10, currentX)),
            y: Math.max(40, Math.min(SCREEN_HEIGHT - CALC_HEIGHT - 60, currentY)),
          },
          7,
          40,
        );
      }
    },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  });

  return {
    pan,
    panHandlers: panResponder.panHandlers,
    // Open: centre of the screen. Close: back to the snapped bubble position.
    setOpen: (isOpen: boolean) => {
      const target = isOpen
        ? { x: (SCREEN_WIDTH - CALC_WIDTH) / 2, y: (SCREEN_HEIGHT - CALC_HEIGHT) / 2 }
        : snapped;
      if (target.x === position.x && target.y === position.y) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      springTo(target, 7, 35);
    },
  };
}

export default function FloatingCalculator({ onInsert }: FloatingCalculatorProps) {
  // The store is the single source of truth for open/closed, so the bubble, the keypad
  // shortcut and the Insert button can never get out of sync.
  const isOpen = useLocalStore((state) => state.isCalculatorOpen);
  const closeCalculator = useLocalStore((state) => state.closeCalculator);
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('0');
  const [gesture] = useState(createCalculatorGesture);
  const { pan, panHandlers } = gesture;

  // Animate between the bubble spot and the screen centre whenever the calculator opens/closes
  useEffect(() => {
    gesture.setOpen(isOpen);
  }, [isOpen, gesture]);

  const updateLiveResult = (expr: string) => {
    if (!expr.trim()) {
      setResult('0');
      return;
    }

    try {
      let sanitized = expr
        .replace(/x/g, '*')
        .replace(/÷/g, '/')
        .replace(/×/g, '*');
      
      // Smart percentage math: replace A + B% with A + (A * B * 0.01) and A - B% with A - (A * B * 0.01)
      const percentRegex = /(\d+(?:\.\d+)?)\s*([\+\-])\s*(\d+(?:\.\d+)?)\s*%/g;
      sanitized = sanitized.replace(percentRegex, (match, num1, op, num2) => {
        return `${num1} ${op} (${num1} * ${num2} * 0.01)`;
      });
      
      // Standard percentage fallback (e.g. 500 * 10% -> 500 * 10 * 0.01)
      sanitized = sanitized.replace(/%/g, '*0.01');
      
      // Strip trailing operators for running evaluation
      while (/[\+\-\*\/]$/.test(sanitized)) {
        sanitized = sanitized.slice(0, -1);
      }

      if (sanitized.trim() && /^[0-9+\-*/().\s]+$/.test(sanitized)) {
        const evalResult = new Function(`return (${sanitized})`)();
        if (evalResult !== undefined && !isNaN(evalResult) && isFinite(evalResult)) {
          setResult(Number(evalResult.toFixed(2)).toString());
        }
      }
    } catch {
      // Ignore intermediate syntax failures while typing formula
    }
  };

  const handleKeyPress = (val: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (val === 'C') {
      setExpression('');
      setResult('0');
      return;
    }

    if (val === '⌫') {
      const updated = expression.slice(0, -1);
      setExpression(updated);
      updateLiveResult(updated);
      return;
    }

    if (val === '()') {
      const openCount = (expression.match(/\(/g) || []).length;
      const closeCount = (expression.match(/\)/g) || []).length;
      
      const lastChar = expression.slice(-1);
      const isLastDigitOrSymbol = /[0-9\%\)]/.test(lastChar);

      if (openCount > closeCount && isLastDigitOrSymbol) {
        const newExpression = expression + ')';
        setExpression(newExpression);
        updateLiveResult(newExpression);
      } else {
        let prefix = '';
        if (lastChar && /[0-9\%\)]/.test(lastChar)) {
          prefix = 'x';
        }
        const newExpression = expression + prefix + '(';
        setExpression(newExpression);
        updateLiveResult(newExpression);
      }
      return;
    }

    if (val === '=') {
      try {
        let sanitized = expression
          .replace(/x/g, '*')
          .replace(/÷/g, '/')
          .replace(/×/g, '*');
        
        // Smart percentage math: replace A + B% with A + (A * B * 0.01) and A - B% with A - (A * B * 0.01)
        const percentRegex = /(\d+(?:\.\d+)?)\s*([\+\-])\s*(\d+(?:\.\d+)?)\s*%/g;
        sanitized = sanitized.replace(percentRegex, (match, num1, op, num2) => {
          return `${num1} ${op} (${num1} * ${num2} * 0.01)`;
        });
        
        // Standard percentage fallback
        sanitized = sanitized.replace(/%/g, '*0.01');
        
        // Resilience: clean trailing mathematical operators
        while (/[\+\-\*\/]$/.test(sanitized)) {
          sanitized = sanitized.slice(0, -1);
        }

        if (!sanitized.trim()) {
          setResult('0');
          return;
        }

        if (!/^[0-9+\-*/().\s]+$/.test(sanitized)) {
          throw new Error('Invalid Syntax');
        }
        
        const evalResult = new Function(`return (${sanitized})`)();
        if (evalResult === undefined || isNaN(evalResult) || !isFinite(evalResult)) {
          setResult('Error');
        } else {
          const finalVal = Number(evalResult.toFixed(2)).toString();
          setExpression(finalVal);
          setResult(finalVal);
        }
      } catch {
        setResult('Error');
      }
      return;
    }

    // Append digit or operator to formula
    const newExpression = expression + val;
    setExpression(newExpression);
    updateLiveResult(newExpression);
  };

  const handleInsert = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onInsert(result);
    closeCalculator();
  };

  return (
    <View style={styles.fullscreenOverlay} pointerEvents="box-none">
      <Animated.View 
        style={[
          styles.container, 
          {
            left: pan.x,
            top: pan.y,
            width: isOpen ? CALC_WIDTH : BUBBLE_SIZE,
            height: isOpen ? CALC_HEIGHT : BUBBLE_SIZE,
          }
        ]}
      >
        {!isOpen ? (
          // Draggable Floating Bubble (Uses standard panHandlers for 100% touch capture)
          <View
            {...panHandlers}
            style={styles.bubble}
          >
            <Calculator color="#FFFFFF" size={26} />
          </View>
        ) : (
          // Expanded Glassmorphism Calculator panel fitting 100% inside container
          <View style={styles.calcPanel}>
            {/* Header Controls (Draggable when open!) */}
            <View {...panHandlers} style={styles.header}>
              <Text style={styles.headerTitle}>In-App Calculator ✥</Text>
            </View>

            {/* Close Button positioned absolutely (sibling to prevent PanResponder touch intercept) */}
            <TouchableOpacity onPress={closeCalculator} style={styles.closeBtn}>
              <X color="#8E8E93" size={18} />
            </TouchableOpacity>

            {/* Screen Output Display */}
            <View style={styles.displayContainer}>
              <Text numberOfLines={1} style={styles.expressionText}>
                {expression ? `= ${result}` : ' '}
              </Text>
              <Text numberOfLines={1} style={styles.resultText}>
                {expression || '0'}
              </Text>
            </View>

            {/* Keys Matrix Grid */}
            <View style={styles.keysGrid}>
              <View style={styles.row}>
                <TouchableOpacity onPress={() => handleKeyPress('C')} style={[styles.key, styles.keyAction]}>
                  <Text style={styles.keyTextAction}>C</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleKeyPress('()')} style={[styles.key, styles.keyAction]}>
                  <Text style={styles.keyTextAction}>()</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleKeyPress('%')} style={[styles.key, styles.keyAction]}>
                  <Text style={styles.keyTextAction}>%</Text>
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
                <TouchableOpacity onPress={() => handleKeyPress('0')} style={styles.key}>
                  <Text style={styles.keyText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleKeyPress('.')} style={styles.key}>
                  <Text style={styles.keyText}>.</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleKeyPress('⌫')} style={[styles.key, styles.keyAction]}>
                  <Text style={styles.keyTextAction}>⌫</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
  },
  container: {
    position: 'absolute',
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: '#AF52DE',
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
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    borderWidth: 1.5,
    borderColor: '#2C2C2E',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    marginBottom: 10,
    paddingRight: 32, // Prevent overlap with the close button
  },
  headerTitle: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 99,
    padding: 6,
  },
  displayContainer: {
    backgroundColor: '#121214',
    borderRadius: 10,
    padding: 8,
    alignItems: 'flex-end',
    height: 62,
    marginBottom: 12,
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
    height: 224,
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  key: {
    width: 50,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyZero: {
    width: 110,
  },
  keyAction: {
    backgroundColor: '#3A3A3C',
  },
  keyOperator: {
    backgroundColor: '#AF52DE',
  },
  keyEquals: {
    backgroundColor: '#0A84FF',
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
    height: 40,
    marginTop: 12,
  },
  insertBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
});
