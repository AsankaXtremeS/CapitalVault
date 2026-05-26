import React from 'react';
import { StyleSheet, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { MessageSquare } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface WhatsAppReminderProps {
  contactName: string;
  contactPhone?: string;
  amount: number;
  type: 'lending' | 'borrowing';
}

export default function WhatsAppReminder({
  contactName,
  contactPhone,
  amount,
  type,
}: WhatsAppReminderProps) {
  
  const handleSendReminder = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!contactPhone) {
      Alert.alert('Phone Number Required', 'Please configure a phone number to send automated reminders.');
      return;
    }

    // Standardize phone number by removing spaces, brackets, hyphens
    const cleanPhone = contactPhone.replace(/[+\s()-]/g, '');

    // Formulate a professional, friendly reminder message
    const message = type === 'lending'
      ? `Hi ${contactName}, friendly reminder regarding the outstanding $${amount.toFixed(2)} that was lent. Let me know when you can settle it. Thanks!`
      : `Hi ${contactName}, regarding the outstanding $${amount.toFixed(2)} I borrowed, I wanted to let you know that I am tracking the balance and will update you on repayment soon. Thanks!`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;
    const fallbackUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to web link if WhatsApp application is not installed on device
        await Linking.openURL(fallbackUrl);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open WhatsApp. Please check if the app is installed.');
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.button}
      onPress={handleSendReminder}
    >
      <MessageSquare color="#FFFFFF" size={15} />
      <Text style={styles.buttonText}>Send WhatsApp</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#0A84FF', // Electric blue reminder button
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
});
