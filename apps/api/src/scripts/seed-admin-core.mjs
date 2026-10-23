// MongoDB admin seeding logic kept separate so it can be tested without a live DB.
export function isEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

export function parseSeedOptions(argv, env) {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const email = String(positional[0] || env.DEFAULT_ADMIN_EMAIL || 'admin@gmail.com').trim().toLowerCase();
  const username = String(positional[1] || env.DEFAULT_ADMIN_USERNAME || 'admin').trim();
  const password = positional[2] || env.DEFAULT_ADMIN_PASSWORD;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid admin email');
  }
  if (!username || /\s/.test(username)) {
    throw new Error('Admin username must be nonempty and contain no whitespace');
  }

  return {
    email,
    username,
    password,
    resetPassword: argv.includes('--reset-password'),
    reactivate: argv.includes('--reactivate'),
    allowWeakPassword: isEnabled(env.ADMIN_SEED_ALLOW_WEAK_PASSWORD),
  };
}

function validateNewPassword(password, allowWeakPassword) {
  if (!password) {
    throw new Error('DEFAULT_ADMIN_PASSWORD is required to create/reset an admin.');
  }
  if (password.length < 12 && !allowWeakPassword) {
    throw new Error('Password must contain at least 12 characters. For local DEV ONLY, explicitly set ADMIN_SEED_ALLOW_WEAK_PASSWORD=true.');
  }
}

/**
 * Create only if absent. Never reset a real admin password on ordinary startup.
 * Reject ambiguous email/username matches instead of modifying someone else.
 */
export async function seedAdminRecord(collection, options, hashPassword) {
  const { email, username, password, resetPassword, reactivate, allowWeakPassword } = options;
  const [byEmail, byUsername] = await Promise.all([
    collection.findOne({ email }),
    collection.findOne({ username }),
  ]);

  if (byEmail && byUsername && String(byEmail._id) !== String(byUsername._id)) {
    throw new Error('Email and username belong to different admin accounts; refusing to merge.');
  }

  const existing = byEmail || byUsername;
  if (existing) {
    if (existing.email !== email || existing.username !== username) {
      throw new Error('Existing admin identity differs from the seed settings; refusing to overwrite.');
    }
    if (!resetPassword && !reactivate) {
      return { status: existing.isDeleted ? 'existing-disabled' : 'existing', email, username };
    }
    const changes = { updatedAt: new Date() };
    if (resetPassword) {
      validateNewPassword(password, allowWeakPassword);
      changes.password = await hashPassword(password);
    }
    if (reactivate) changes.isDeleted = false;
    const update = { $set: changes };
    if (reactivate) update.$unset = { deletedAt: '' };
    await collection.updateOne({ _id: existing._id }, update);
    return { status: 'updated', email, username };
  }

  validateNewPassword(password, allowWeakPassword);
  const now = new Date();
  await collection.insertOne({
    email,
    username,
    password: await hashPassword(password),
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });
  return { status: 'created', email, username };
}
