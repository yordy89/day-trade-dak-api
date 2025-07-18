#!/bin/bash

# Script to switch between standard and optimized main.ts

echo "Switching to optimized main.ts..."

# Backup current main.ts
if [ ! -f "src/main.ts.backup" ]; then
    cp src/main.ts src/main.ts.backup
    echo "✅ Created backup of original main.ts"
fi

# Copy optimized version to main.ts
cp src/main.optimized.ts src/main.ts
echo "✅ Switched to optimized main.ts"

echo ""
echo "To revert to original main.ts, run:"
echo "  cp src/main.ts.backup src/main.ts"
echo ""
echo "You can now start the application with:"
echo "  npm run start:dev"