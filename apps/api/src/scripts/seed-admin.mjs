import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { loadRootEnv } from './load-root-env.mjs';

loadRootEnv();

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/english-platform';

const email =
  process.argv[2] || process.env.DEFAULT_ADMIN_EMAIL || 'admin@gmail.com';
const username =
  process.argv[3] || process.env.DEFAULT_ADMIN_USERNAME || 'admin';
// Keep this in sync with AdminsService.
const rawPassword =
  process.argv[4] || process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

async function createAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(rawPassword, saltRounds);

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection is not ready');
    }

    const adminCollection = db.collection('admins');

    await adminCollection.findOneAndUpdate(
      {
        $or: [
          { email: email.toLowerCase().trim() },
          { username: username.trim() },
        ],
      },
      {
        $set: {
          email: email.toLowerCase().trim(),
          username: username.trim(),
          password: hashedPassword,
          isDeleted: false,
          updatedAt: new Date(),
        },
        $unset: {
          deletedAt: '',
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    console.log('\n========================================');
    console.log('Admin account created / updated successfully:');
    console.log(`- Email:    ${email.toLowerCase().trim()}`);
    console.log(`- Username: ${username.trim()}`);
    console.log('========================================\n');
  } catch (err) {
    console.error('Error creating admin account:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

await createAdmin();
