import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { loadRootEnv } from './load-root-env.mjs';
import { isEnabled, parseSeedOptions, seedAdminRecord } from './seed-admin-core.mjs';

loadRootEnv();

const argv = process.argv.slice(2);
const automatic = argv.includes('--auto');

// Automatic startup is opt-in. Manual invocation does not require this flag.
if (automatic && !isEnabled(process.env.ADMIN_SEED_ENABLED)) {
  console.log('[admin-seed] Skipped: set ADMIN_SEED_ENABLED=true to enable automatic seeding.');
  process.exit(0);
}

try {
  const options = parseSeedOptions(argv, process.env);
  const uri = process.env.MONGO_IDENTITY_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_IDENTITY_URI or MONGO_URI is required');

  if (options.password && options.password.length < 12 && options.allowWeakPassword) {
    console.warn('[admin-seed] WARNING: weak admin password enabled. Use only for local development.');
  }

  await mongoose.connect(uri, { dbName: 'identity_db', serverSelectionTimeoutMS: 20000 });
  const database = mongoose.connection.db;
  if (!database) throw new Error('MongoDB connection is not ready');

  const result = await seedAdminRecord(
    database.collection('admins'),
    options,
    (password) => bcrypt.hash(password, 12),
  );
  console.log(`[admin-seed] ${result.status}: email=${result.email}, username=${result.username}`);
  if (result.status === 'existing-disabled') {
    console.warn('[admin-seed] Account is disabled. Use --reactivate explicitly if intended.');
  }
} catch (error) {
  console.error('[admin-seed] ERROR:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
