// Test BNPL logic

function getBNPLMethods(amount, currency, isRecurring = false) {
  const bnplMethods = [];
  
  // BNPL methods are generally not available for subscriptions
  if (isRecurring) {
    return bnplMethods;
  }
  
  // Currency must be lowercase for Stripe
  const lowerCurrency = currency.toLowerCase();
  
  // Klarna availability
  // Minimum: $1 USD, Maximum: $10,000 USD
  if (['usd', 'eur', 'gbp', 'sek', 'nok', 'dkk', 'chf', 'aud', 'nzd', 'cad', 'pln', 'czk'].includes(lowerCurrency)) {
    if (lowerCurrency === 'usd' && amount >= 1 && amount <= 10000) {
      bnplMethods.push('klarna');
      console.log('✅ Klarna added (USD amount within $1-$10,000)');
    } else if (lowerCurrency === 'eur' && amount >= 1 && amount <= 10000) {
      bnplMethods.push('klarna');
    } else if (amount >= 1 && amount <= 15000) {
      bnplMethods.push('klarna');
    }
  }
  
  // Afterpay/Clearpay availability
  // Minimum: $1 USD, Maximum: $2,000 USD (varies by region)
  if (['usd', 'cad', 'gbp', 'aud', 'nzd', 'eur'].includes(lowerCurrency)) {
    if (lowerCurrency === 'usd' && amount >= 1 && amount <= 2000) {
      bnplMethods.push('afterpay_clearpay');
      console.log('✅ Afterpay/Clearpay added (USD amount within $1-$2,000)');
    } else if (lowerCurrency === 'aud' && amount >= 1 && amount <= 2000) {
      bnplMethods.push('afterpay_clearpay');
    } else if (amount >= 1 && amount <= 1000) {
      bnplMethods.push('afterpay_clearpay');
    } else {
      console.log(`❌ Afterpay/Clearpay NOT added (USD amount $${amount} exceeds $2,000 limit)`);
    }
  }
  
  // Affirm availability (US only)
  // Minimum: $50 USD, Maximum: $30,000 USD
  if (lowerCurrency === 'usd' && amount >= 50 && amount <= 30000) {
    bnplMethods.push('affirm');
    console.log('✅ Affirm added (USD amount within $50-$30,000)');
  }
  
  return bnplMethods;
}

// Test cases
console.log('Testing BNPL logic for different amounts:\n');

console.log('1. Master Course ($2,999.99):');
const masterCourseBNPL = getBNPLMethods(2999.99, 'USD', false);
console.log('Result:', masterCourseBNPL);
console.log('');

console.log('2. Subscription ($52.99/month):');
const subscriptionBNPL = getBNPLMethods(52.99, 'USD', true);
console.log('Result:', subscriptionBNPL, '(empty because it\'s recurring)');
console.log('');

console.log('3. Small amount ($25):');
const smallAmountBNPL = getBNPLMethods(25, 'USD', false);
console.log('Result:', smallAmountBNPL);
console.log('');

console.log('4. Large amount ($15,000):');
const largeAmountBNPL = getBNPLMethods(15000, 'USD', false);
console.log('Result:', largeAmountBNPL);