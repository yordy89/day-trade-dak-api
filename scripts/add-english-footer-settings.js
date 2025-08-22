const mongoose = require('mongoose');
require('dotenv').config();

async function addEnglishFooterSettings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/daytradedak');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const settingsCollection = db.collection('settings');
    
    // Add footer_en settings
    const footerEnSettings = [
      {
        key: 'footer_en.footer_company_description',
        value: 'Your trusted platform for professional trading. Training, mentorship and community for serious traders.',
        type: 'text',
        category: 'footer',
        label: 'Footer Company Description (English)',
        description: 'Company description shown in the footer (English)',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'footer_en.footer_copyright_text',
        value: '© {{year}} DayTradeDak. All rights reserved.',
        type: 'text',
        category: 'footer',
        label: 'Footer Copyright Text (English)',
        description: 'Copyright text shown in the footer (English)',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const setting of footerEnSettings) {
      await settingsCollection.updateOne(
        { key: setting.key },
        { $set: setting },
        { upsert: true }
      );
      console.log(`Added/Updated setting: ${setting.key}`);
    }

    console.log('Successfully added English footer settings');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

addEnglishFooterSettings();