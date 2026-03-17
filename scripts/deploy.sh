#!/bin/bash
set -e

# Build all packages
pnpm turbo build

# Strip workspace:* deps from functions package.json before deploy
# (Firebase runs npm install in the cloud which doesn't understand pnpm workspace protocol)
cp firebase/functions/package.json firebase/functions/package.json.bak
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('firebase/functions/package.json', 'utf8'));
  pkg.devDependencies = Object.fromEntries(
    Object.entries(pkg.devDependencies || {}).filter(([k]) => !k.startsWith('@vizo/'))
  );
  fs.writeFileSync('firebase/functions/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Deploy functions, firestore rules, and storage rules
# (Web app is deployed automatically via App Hosting on git push)
cd firebase
firebase deploy --only firestore,storage,functions
DEPLOY_EXIT=$?

# Restore original package.json
cd ..
mv firebase/functions/package.json.bak firebase/functions/package.json

exit $DEPLOY_EXIT
