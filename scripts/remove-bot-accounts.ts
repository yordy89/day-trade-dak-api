/**
 * Script to identify and remove bot accounts from the database
 *
 * Bot accounts are identified by:
 * 1. Names with random/gibberish strings (high entropy, random character patterns)
 * 2. Names that are base64-like encoded strings
 * 3. Accounts with no subscriptions and suspicious creation patterns
 *
 * Usage:
 *   npm run script:remove-bots          # Execute removal
 *   npm run script:remove-bots:dry      # Dry run (preview only)
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';

interface UserDocument {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt?: Date;
  subscriptions?: any[];
  status?: string;
}

// Patterns that indicate bot-generated names
const BOT_NAME_PATTERNS = [
  // Random uppercase/lowercase mix with no vowels in normal places
  /^[A-Za-z]{15,}$/,
  // Base64-like patterns
  /^[A-Za-z0-9+/=]{20,}$/,
  // Random string with mixed case and no spaces (unusual for real names)
  /^[A-Z][a-z]+[A-Z][a-z]+[A-Z]/,
  // Very long single "words" (real names are usually shorter)
  /^[A-Za-z]{25,}$/,
];

// Calculate entropy of a string (higher = more random)
function calculateEntropy(str: string): number {
  const len = str.length;
  if (len === 0) return 0;

  const freq: { [key: string]: number } = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  let entropy = 0;
  for (const char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

// Check if name looks like bot-generated
function isBotName(firstName: string, lastName: string): { isBot: boolean; reason: string } {
  const fullName = `${firstName} ${lastName}`;
  const combinedName = `${firstName}${lastName}`;

  // Check for very high entropy (random strings have high entropy)
  const entropy = calculateEntropy(combinedName.toLowerCase());
  if (entropy > 4.0 && combinedName.length > 15) {
    return { isBot: true, reason: `High entropy name (${entropy.toFixed(2)})` };
  }

  // Check for unusual character patterns
  for (const pattern of BOT_NAME_PATTERNS) {
    if (pattern.test(firstName) || pattern.test(lastName)) {
      return { isBot: true, reason: `Matches bot pattern: ${pattern}` };
    }
  }

  // Check for too many consecutive consonants (unusual in real names)
  const consonantPattern = /[bcdfghjklmnpqrstvwxyz]{5,}/i;
  if (consonantPattern.test(firstName) || consonantPattern.test(lastName)) {
    return { isBot: true, reason: 'Too many consecutive consonants' };
  }

  // Check for no vowels in long names
  const vowelPattern = /[aeiou]/i;
  if (firstName.length > 5 && !vowelPattern.test(firstName)) {
    return { isBot: true, reason: 'No vowels in long first name' };
  }
  if (lastName.length > 5 && !vowelPattern.test(lastName)) {
    return { isBot: true, reason: 'No vowels in long last name' };
  }

  // Check for mixed case in unusual positions (like "AppbYuSoMHNIwcJjgDgdm")
  const mixedCasePattern = /[a-z][A-Z][a-z][A-Z]/;
  if (mixedCasePattern.test(firstName) || mixedCasePattern.test(lastName)) {
    return { isBot: true, reason: 'Unusual mixed case pattern' };
  }

  // Check for names that are too long (most real names are under 15 chars)
  if (firstName.length > 20 || lastName.length > 20) {
    return { isBot: true, reason: 'Name too long' };
  }

  return { isBot: false, reason: '' };
}

// Check for suspicious email patterns
function isSuspiciousEmail(email: string): { isSuspicious: boolean; reason: string } {
  const emailLower = email.toLowerCase();

  // Random string before @ with high entropy
  const localPart = emailLower.split('@')[0];
  const entropy = calculateEntropy(localPart);

  if (entropy > 3.5 && localPart.length > 10 && /[a-z0-9]{10,}/.test(localPart)) {
    return { isSuspicious: true, reason: `High entropy email local part (${entropy.toFixed(2)})` };
  }

  return { isSuspicious: false, reason: '' };
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('BOT ACCOUNT REMOVAL SCRIPT');
  console.log('='.repeat(60));
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'EXECUTE'}`);
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const userModel = app.get<Model<UserDocument>>(getModelToken('User'));

    // Find all users
    const users = await userModel.find({
      isDeleted: { $ne: true },
    }).lean();

    console.log(`Total users in database: ${users.length}`);
    console.log('');

    const botAccounts: Array<{
      user: UserDocument;
      reasons: string[];
    }> = [];

    for (const user of users) {
      const reasons: string[] = [];

      // Check name
      const nameCheck = isBotName(user.firstName || '', user.lastName || '');
      if (nameCheck.isBot) {
        reasons.push(`Bot name: ${nameCheck.reason}`);
      }

      // Check email
      const emailCheck = isSuspiciousEmail(user.email || '');
      if (emailCheck.isSuspicious) {
        reasons.push(`Suspicious email: ${emailCheck.reason}`);
      }

      // Additional check: No subscriptions + suspicious patterns
      const hasSubscriptions = user.subscriptions && user.subscriptions.length > 0;
      if (reasons.length > 0 && !hasSubscriptions) {
        reasons.push('No subscriptions');
      }

      // Only flag as bot if name check passes (primary indicator)
      if (nameCheck.isBot) {
        botAccounts.push({ user, reasons });
      }
    }

    console.log(`Found ${botAccounts.length} suspected bot accounts:`);
    console.log('-'.repeat(60));

    for (const { user, reasons } of botAccounts) {
      console.log(`\nUser: ${user.firstName} ${user.lastName}`);
      console.log(`Email: ${user.email}`);
      console.log(`ID: ${user._id}`);
      console.log(`Created: ${user.createdAt || 'N/A'}`);
      console.log(`Reasons: ${reasons.join(', ')}`);
    }

    console.log('\n' + '-'.repeat(60));

    if (botAccounts.length === 0) {
      console.log('No bot accounts found.');
      return;
    }

    if (isDryRun) {
      console.log(`\nDRY RUN: Would delete ${botAccounts.length} accounts`);
      console.log('Run without --dry-run to execute deletion');
    } else {
      console.log(`\nDeleting ${botAccounts.length} bot accounts...`);

      const userIds = botAccounts.map(({ user }) => user._id);

      // Soft delete the accounts
      const result = await userModel.updateMany(
        { _id: { $in: userIds } },
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            deletionReason: 'terms_violation',
            status: 'deleted',
          },
        },
      );

      console.log(`Successfully deleted ${result.modifiedCount} bot accounts`);

      // Log deleted account IDs for reference
      console.log('\nDeleted account IDs:');
      for (const id of userIds) {
        console.log(`  - ${id}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Script completed');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error running script:', error);
    throw error;
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
