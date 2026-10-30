#!/usr/bin/env bash
set -euo pipefail

# PalmSight Secret Generator
# Generates strong random secrets using Node crypto (crypto.randomBytes(64).toString('hex'))

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if command -v node >/dev/null 2>&1; then
  node -e "
    const crypto = require('crypto');
    const gen = () => crypto.randomBytes(64).toString('hex');
    console.log('================================================================');
    console.log('  PalmSight Production Secret Generator (US-DEPLOY-01)');
    console.log('================================================================\n');
    console.log('# Generic secret keys:');
    console.log('JWT_SECRET=' + gen());
    console.log('JWT_REFRESH_SECRET=' + gen());
    console.log('HMAC_SECRET=' + gen() + '\n');
    console.log('# PalmSight backend/.env mapped keys:');
    console.log('JWT_ACCESS_SECRET=' + gen());
    console.log('IDENTITY_HASH_SECRET=' + gen() + '\n');
    console.log('----------------------------------------------------------------');
    console.log('⚠️  Store these secrets securely (e.g. Render Dashboard / Key Vault).');
    console.log('⚠️  DO NOT commit secrets to Git repositories.');
    console.log('================================================================');
  "
else
  pnpm --filter backend generate:secrets
fi
