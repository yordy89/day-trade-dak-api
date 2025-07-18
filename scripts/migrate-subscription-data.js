#!/usr/bin/env node

/**
 * Script to run the subscription data migration
 * Usage: npm run migrate:subscriptions
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting subscription data migration...\n');

try {
  // Run the TypeScript migration file using ts-node
  const migrationPath = path.join(__dirname, '../src/migrations/populate-complete-subscription-data.ts');
  
  // Escape the path for shell execution
  const escapedPath = `"${migrationPath}"`;
  
  execSync(`npx ts-node ${escapedPath}`, {
    stdio: 'inherit',
    env: { ...process.env },
    cwd: path.join(__dirname, '..')
  });
  
  console.log('\n✅ Migration completed successfully!');
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}