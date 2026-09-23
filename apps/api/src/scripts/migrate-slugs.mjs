import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...vals] = trimmed.split('=');
      if (key && vals.length > 0) {
        process.env[key.trim()] = vals.join('=').trim();
      }
    }
  }
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/english-platform';

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function migrateSlugs() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');
  const collection = mongoose.connection.db.collection('words');

  const words = await collection.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] }).toArray();
  console.log(`Found ${words.length} words needing slug backfill`);

  if (words.length === 0) {
    console.log('All words already have slug.');
    await mongoose.disconnect();
    return;
  }

  const existingSlugs = new Set();
  const allSlugs = await collection.distinct('slug', { slug: { $exists: true, $ne: null } });
  allSlugs.forEach((s) => existingSlugs.add(s));

  const bulkOps = [];
  for (const doc of words) {
    const base = slugify(doc.word) || 'word';
    let slug = base;
    let counter = 1;
    while (existingSlugs.has(slug)) {
      slug = `${base}-${counter++}`;
    }
    existingSlugs.add(slug);

    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { slug } },
      },
    });

    if (bulkOps.length >= 1000) {
      await collection.bulkWrite(bulkOps);
      console.log(`Updated 1000 words...`);
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    await collection.bulkWrite(bulkOps);
  }

  console.log(`Successfully backfilled slug for ${words.length} words!`);

  // Ensure index
  try {
    await collection.createIndex({ slug: 1 }, { unique: true });
    console.log('Created unique index on slug');
  } catch (err) {
    console.warn('Index notice:', err.message);
  }

  await mongoose.disconnect();
}

migrateSlugs().catch((err) => {
  console.error(err);
  process.exit(1);
});
