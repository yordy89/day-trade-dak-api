# NestJS 11 Migration Guide for DayTradeDakApi

## Overview
This document outlines the steps to migrate DayTradeDakApi from NestJS 10 to NestJS 11.

## Prerequisites
- Node.js v20 or higher (required)
- Update all dependencies to latest compatible versions

## Breaking Changes

### 1. Node.js Version
- **Minimum required**: Node.js v20
- Node.js v16 and v18 are no longer supported

### 2. Express Version
- Express v5 is now the default
- Some middleware may need updates

### 3. Reflector Class Changes
- `getAllAndMerge` now returns an object (not array) for single metadata entries
- `getAllAndOverride` return type updated to `T | undefined` instead of `T`

### 4. Cache Manager
- Updated to cache-manager v6
- Now uses Keyv for unified key-value storage

## New Features

### 1. Enhanced ConsoleLogger
```typescript
const app = await NestFactory.create(AppModule, {
  logger: new ConsoleLogger({
    json: true,
    colors: process.env.NODE_ENV === 'development',
  }),
});
```

### 2. IntrinsicException Class
For exceptions that should bypass automatic logging:
```typescript
throw new IntrinsicException('Sensitive error', { cause: error });
```

### 3. Microservice Enhancements
- New `unwrap()` method for direct client access
- Improved transporter support

### 4. Request-Scoped Providers in CQRS
- Better support for request-scoped providers
- Strongly-typed commands, events, and queries

## Migration Steps

### Step 1: Update Dependencies
```bash
npm install @nestjs/common@^11 @nestjs/core@^11 @nestjs/platform-express@^11
npm install @nestjs/config@^4 @nestjs/jwt@^11 @nestjs/mongoose@^11
npm install @nestjs/passport@^11 @nestjs/schedule@^6
```

### Step 2: Update Dev Dependencies
```bash
npm install -D @nestjs/cli@^11 @nestjs/schematics@^11 @nestjs/testing@^11
```

### Step 3: Update Node.js
Ensure you're running Node.js v20 or higher:
```bash
node -v  # Should output v20.x.x or higher
```

### Step 4: Update Code
1. Review any custom logger implementations
2. Check cache-manager usage
3. Update any Reflector usage if applicable

### Step 5: Test Thoroughly
- Run all unit tests
- Run e2e tests
- Test all API endpoints
- Verify authentication flows
- Check scheduled tasks

## Rollback Plan
If issues arise:
1. Revert package.json changes
2. Run `npm install`
3. Ensure Node.js compatibility