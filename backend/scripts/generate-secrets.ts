import * as crypto from 'crypto';

export interface GeneratedSecrets {
  jwtSecret: string;
  jwtRefreshSecret: string;
  hmacSecret: string;
  jwtAccessSecret: string;
  identityHashSecret: string;
}

export function generateRandomSecret(byteLength: number = 64): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

export function generateAllSecrets(): GeneratedSecrets {
  return {
    jwtSecret: generateRandomSecret(64),
    jwtRefreshSecret: generateRandomSecret(64),
    hmacSecret: generateRandomSecret(64),
    jwtAccessSecret: generateRandomSecret(64),
    identityHashSecret: generateRandomSecret(64),
  };
}

export function printSecrets(secrets: GeneratedSecrets): void {
  console.log('================================================================');
  console.log('  PalmSight Production Secret Generator (US-DEPLOY-01)');
  console.log('================================================================\n');
  console.log('Strong random 64-byte (128 hex chars) secrets generated:\n');

  console.log('# Generic secret keys:');
  console.log(`JWT_SECRET=${secrets.jwtSecret}`);
  console.log(`JWT_REFRESH_SECRET=${secrets.jwtRefreshSecret}`);
  console.log(`HMAC_SECRET=${secrets.hmacSecret}\n`);

  console.log('# PalmSight backend/.env mapped keys:');
  console.log(`JWT_ACCESS_SECRET=${secrets.jwtAccessSecret}`);
  console.log(`IDENTITY_HASH_SECRET=${secrets.identityHashSecret}\n`);

  console.log('----------------------------------------------------------------');
  console.log('⚠️  Store these secrets securely (e.g. Render Dashboard / Key Vault).');
  console.log('⚠️  DO NOT commit secrets to Git repositories.');
  console.log('================================================================');
}

function main(): void {
  const secrets = generateAllSecrets();
  printSecrets(secrets);
}

if (require.main === module || (process.argv[1] && process.argv[1].endsWith('generate-secrets.ts'))) {
  main();
}
