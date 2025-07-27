# Fix Stripe Customer ID Index Issue

## Problem
Users cannot create accounts because MongoDB is throwing a duplicate key error:
```
E11000 duplicate key error collection: daytradedak.users index: stripeCustomerId_1 dup key: { stripeCustomerId: null }
```

This happens because the `stripeCustomerId` field has a unique index that doesn't allow multiple `null` values.

## Solution
We need to make the index "sparse" which allows multiple documents to have `null` or missing values while still enforcing uniqueness for non-null values.

## Steps to Fix

### 1. Run the Migration Script
```bash
cd /Users/yordy/Documents/Personal/AlbeTech\ Solution/Projects/DayTradeDak/DayTradeDakAPI
npx ts-node scripts/fix-stripe-customer-id-index.ts
```

### 2. Alternatively, Fix Manually via MongoDB Shell
```javascript
// Connect to your MongoDB
use daytradedak

// Drop the existing index
db.users.dropIndex("stripeCustomerId_1")

// Create new sparse index
db.users.createIndex(
  { stripeCustomerId: 1 }, 
  { unique: true, sparse: true, name: "stripeCustomerId_sparse" }
)

// Verify
db.users.getIndexes()
```

### 3. Restart the API Server
After fixing the index, restart your API server to ensure it picks up the changes.

## What This Fixes
- ✅ Allows multiple users to register without Stripe customer IDs
- ✅ Still ensures Stripe customer IDs are unique when present
- ✅ Prevents duplicate key errors during user registration

## Prevention
The schema has been updated to include `sparse: true` so future deployments will create the correct index type.