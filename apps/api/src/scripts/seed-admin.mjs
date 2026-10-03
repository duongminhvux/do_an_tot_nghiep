import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read apps/api/.env only as a fallback. Runtime variables supplied by
// Docker Compose must win over values in the file.
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...vals] = trimmed.split('=');
      const normalizedKey = key?.trim();
      if (
        normalizedKey &&
        vals.length > 0 &&
        process.env[normalizedKey] === undefined
      ) {
        process.env[normalizedKey] = vals.join('=').trim();
      }
    }
  }
}

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
