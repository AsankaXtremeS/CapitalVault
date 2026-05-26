import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { Delete, Calculator, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface NumericalKeyboardProps {
  value: string;
  onChange: (newValue: string) => void;
  onDone: () => void;
  onOpenCalculator?: () => void;
}

export default function NumericalKeyboard({
  value,
  onChange,
  onDone,
  onOpenCalculator,
}: NumericalKeyboardProps) {
  
  const handlePress = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (key === 'backspace') {
      if (value.length > 0) {
        onChange(value.slice(0, -1));
      }
      return;
    }

    if (key === '.') {
      // Prevent multiple decimals
      if (value.includes('.')) return;
      if (value === '') {
        onChange('0.');
      } else {
        onChange(value + '.');
      }
      return;
    }

    // Normal digit entry
    // Limit to 9 digits to prevent UI overflow
    if (value.replace('.', '').length >= 9) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // Replace initial zero
    if (value === '0') {
      onChange(key);
    } else {
      onChange(value + key);
    }
  };

  const handleDone = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone();
  };

  return (
    <View style={styles.keyboardContainer}>
      {/* Keypad Header bar */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Amount Entry</Text>
        <TouchableOpacity style={styles.doneHeaderBtn} onPress={handleDone}>
          <Text style={styles.doneHeaderText}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Keys Layout */}
      <View style={styles.keysGrid}>
        {/* Row 1 */}
        <View style={styles.row}>
          <TouchableOpacity style={styles.key} onPress={() => handlePress('1')}>
            <Text style={styles.keyText}>1</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handlePress('2')}>
            <Text style={styles.keyText}>2</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handlePress('3')}>
            <Text style={styles.keyText}>3</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.key, styles.utilityKey]} onPress={() => handlePress('backspace')}>
            <Delete color="#FF453A" size={22} />
          </TouchableOpacity>
        </View>

        {/* Row 2 */}
        <View style={styles.row}>
          <TouchableOpacity style={styles.key} onPress={() => handlePress('4')}>
            <Text style={styles.keyText}>4</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handlePress('5')}>
            <Text style={styles.keyText}>5</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handlePress('6')}>
            <Text style={styles.keyText}>6</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.key, styles.utilityKey]} onPress={() => handlePress('-')}>
            <Text style={styles.mathText}>-</Text>
          </TouchableOpacity>
        </View>

        {/* Row 3 */}
        <View style={styles.row}>
          <TouchableOpacity style={styles.key} onPress={() => handlePress('7')}>
            <Text style={styles.keyText}>7</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handlePress('8')}>
            <Text style={styles.keyText}>8</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handlePress('9')}>
            <Text style={styles.keyText}>9</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.key, styles.utilityKey]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onOpenCalculator?.();
            }}
          >
            <Calculator color="#AF52DE" size={22} />
          </TouchableOpacity>
        </View>

        {/* Row 4 */}
        <View style={styles.row}>
          <TouchableOpacity style={[styles.key, styles.zeroKey]} onPress={() => handlePress('0')}>
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handlePress('.')}>
            <Text style={styles.keyText}>.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.key, styles.doneKey]} onPress={handleDone}>
            <Check color="#FFFFFF" size={24} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    backgroundColor: '#1C1C1E', // Sleek slate container
    borderTopWidth: 1.5,
    borderTopColor: '#2C2C2E',
    paddingBottom: 24,
    paddingTop: 10,
    width: SCREEN_WIDTH,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    marginBottom: 8,
  },
  headerText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  doneHeaderBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  doneHeaderText: {
    color: '#0A84FF', // Electric blue active Done
    fontSize: 15,
    fontWeight: '700',
  },
  keysGrid: {
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  key: {
    flex: 1,
    height: 52,
    backgroundColor: '#2C2C2E',
    marginHorizontal: 4,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  zeroKey: {
    flex: 2, // span double width
  },
  utilityKey: {
    backgroundColor: '#222224',
  },
  doneKey: {
    backgroundColor: '#FF453A', // Coral Red done accent
    borderColor: '#FF5E55',
    borderWidth: 0.5,
  },
  keyText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  mathText: {
    fontSize: 24,
    color: '#AF52DE', // Purple math highlights
    fontWeight: '700',
  },
});
