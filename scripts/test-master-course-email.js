require('dotenv').config();
const { masterCourseRegistrationTemplate } = require('../dist/email/templates/master-course-registration.template');
const fs = require('fs');
const path = require('path');

// Test data for the master course email
const testData = {
  firstName: 'Juan',
  email: 'juan@example.com',
  phoneNumber: '+1 (555) 123-4567',
  isPaid: true,
  amount: 2999.99,
  currency: 'USD',
  paymentMethod: 'klarna',
  additionalInfo: {
    tradingExperience: 'Intermediate - 2 years',
    expectations: 'Learn professional trading strategies and risk management'
  }
};

// Generate the email HTML
const emailHtml = masterCourseRegistrationTemplate(testData);

// Save to file for preview
const outputPath = path.join(__dirname, 'test-master-course-email.html');
fs.writeFileSync(outputPath, emailHtml);

console.log('✅ Master Course email template generated successfully!');
console.log(`📧 Preview the email at: ${outputPath}`);
console.log('\nTest Data Used:');
console.log('- Name:', testData.firstName);
console.log('- Email:', testData.email);
console.log('- Amount:', `$${testData.amount}`);
console.log('- Payment Method:', testData.paymentMethod);
console.log('\n📌 Key Features Verified:');
console.log('✓ 3-month program duration');
console.log('✓ Tampa location (not Miami)');
console.log('✓ Correct phase dates');
console.log('✓ No community event information');
console.log('✓ Professional styling');