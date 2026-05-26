/**
 * AI Smart Text Parser (Offline Edge NLP Engine)
 * Processes natural language transaction notes and parses details dynamically.
 */

export interface ParsedTransaction {
  amount: number | null;
  category: string;
  type: 'income' | 'expense';
  account: string;
  date: string; // ISO date string (YYYY-MM-DD)
  note: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: ['lunch', 'dinner', 'breakfast', 'food', 'pizza', 'burger', 'eat', 'grocery', 'groceries', 'restaurant', 'cafe', 'coffee', 'starbucks', 'snack', 'snacks', 'drinks'],
  Transport: ['bus', 'train', 'taxi', 'uber', 'fuel', 'gas', 'petrol', 'transport', 'flight', 'travel', 'parking', 'metro', 'cab', 'cabs'],
  Culture: ['movie', 'game', 'play', 'concert', 'netflix', 'spotify', 'entertainment', 'culture', 'book', 'books', 'cinema', 'show', 'ticket'],
  Household: ['rent', 'electricity', 'water', 'wifi', 'bill', 'household', 'cleaning', 'furniture', 'appliance', 'appliances', 'power', 'internet'],
  Apparel: ['shirt', 'shoes', 'dress', 'clothes', 'apparel', 'shopping', 'jacket', 't-shirt', 'pants', 'boutique'],
  Beauty: ['beauty', 'hair', 'salon', 'makeup', 'skin', 'cosmetics', 'spa', 'massage', 'perfume'],
  Health: ['doctor', 'medicine', 'hospital', 'health', 'clinic', 'dentist', 'pharmacy', 'gym', 'workout', 'fitness', 'medical'],
  Education: ['school', 'course', 'class', 'tuition', 'education', 'book', 'exam', 'training', 'seminar'],
  Gift: ['gift', 'birthday', 'present', 'anniversary', 'donation', 'charity', 'wedding'],
  Salary: ['salary', 'allowance', 'bonus', 'dividend', 'paycheck', 'income', 'earn', 'earned', 'received'],
  Pets: ['pet', 'dog', 'cat', 'vet', 'animal', 'kibble', 'petfood'],
};

const ACCOUNT_KEYWORDS: Record<string, string[]> = {
  Card: ['card', 'credit', 'debit', 'bank', 'visa', 'mastercard', 'online', 'bank transfer', 'amex', 'paypal', 'applepay', 'googlepay'],
  Cash: ['cash', 'wallet', 'pocket', 'hand', 'bill', 'physical'],
  Accounts: ['savings', 'account', 'checking', 'wire', 'deposit'],
};

export function parseNaturalLanguageTransaction(text: string): ParsedTransaction {
  const lowercaseText = text.toLowerCase();
  
  // 1. Extract Amount
  // Matches: "spent 45", "45.50", "45 dollars", "$45", "usd 45", "45usd"
  const amountRegex = /(?:\$|usd)?\s*(\d+(?:\.\d{1,2})?)\s*(?:dollars|usd|dols)?\b/i;
  const amountMatch = lowercaseText.match(amountRegex);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

  // 2. Extract Type (Income vs Expense)
  let type: 'income' | 'expense' = 'expense';
  if (/\b(received|got|earned|deposit|bonus|salary|income|dividend|refund)\b/.test(lowercaseText)) {
    type = 'income';
  }

  // 3. Extract Category
  let category = type === 'income' ? 'Allowance' : 'Other';
  
  // Custom checks for income categories
  if (type === 'income') {
    if (/\b(salary|paycheck)\b/.test(lowercaseText)) {
      category = 'Salary';
    } else if (/\b(bonus|prize)\b/.test(lowercaseText)) {
      category = 'Bonus';
    } else if (/\b(allowance|pocket)\b/.test(lowercaseText)) {
      category = 'Allowance';
    }
  } else {
    // Check expense keywords
    let maxMatches = 0;
    for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      let matches = 0;
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');
        const matchCount = (lowercaseText.match(regex) || []).length;
        matches += matchCount;
      }
      if (matches > maxMatches) {
        maxMatches = matches;
        category = catName;
      }
    }
  }

  // 4. Extract Account
  let account = 'Cash'; // Default
  let maxAccMatches = 0;
  for (const [accName, keywords] of Object.entries(ACCOUNT_KEYWORDS)) {
    let matches = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matchCount = (lowercaseText.match(regex) || []).length;
      matches += matchCount;
    }
    if (matches > maxAccMatches) {
      maxAccMatches = matches;
      account = accName;
    }
  }

  // 5. Extract Date
  const parsedDate = new Date();
  if (lowercaseText.includes('yesterday')) {
    parsedDate.setDate(parsedDate.getDate() - 1);
  } else if (lowercaseText.includes('day before yesterday')) {
    parsedDate.setDate(parsedDate.getDate() - 2);
  } else {
    const daysAgoMatch = lowercaseText.match(/(\d+)\s*days?\s*ago/);
    if (daysAgoMatch) {
      parsedDate.setDate(parsedDate.getDate() - parseInt(daysAgoMatch[1], 10));
    }
  }

  const dateStr = parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD

  // 6. Clean Note (strip out parsed figures to keep note neat)
  // Let's capitalize the first letter of the original text
  const cleanNote = text.charAt(0).toUpperCase() + text.slice(1);

  return {
    amount,
    category,
    type,
    account,
    date: dateStr,
    note: cleanNote,
  };
}
