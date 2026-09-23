import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env if exists
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
const JSON_PATH = path.resolve(__dirname, '../../../../combined_vocab.json');

async function importVocabulary() {
  console.log('Starting vocabulary import...');
  console.log('JSON Path:', JSON_PATH);

  if (!fs.existsSync(JSON_PATH)) {
    console.error('Error: File combined_vocab.json not found at:', JSON_PATH);
    process.exit(1);
  }

  const rawData = fs.readFileSync(JSON_PATH, 'utf8');
  const rawItems = JSON.parse(rawData);
  console.log(`Loaded ${rawItems.length} raw items from combined_vocab.json`);

  // Deduplicate words and merge their parts
  const uniqueItemsMap = new Map();
  for (const item of rawItems) {
    const key = (item.word || '').toLowerCase().trim();
    if (!key) continue;

    if (!uniqueItemsMap.has(key)) {
      const { id, ...rest } = item;
      uniqueItemsMap.set(key, {
        ...rest,
        word: (item.word || '').trim(),
        isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
        isDeleted: false,
        parts: Array.isArray(item.parts) ? [...item.parts] : [],
      });
    } else {
      const existing = uniqueItemsMap.get(key);
      if (Array.isArray(item.parts)) {
        existing.parts.push(...item.parts);
      }
      if (!existing.image && item.image) existing.image = item.image;
      if (!existing.ipa?.us && item.ipa?.us) {
        existing.ipa = { ...existing.ipa, us: item.ipa.us };
      }
      if (!existing.ipa?.uk && item.ipa?.uk) {
        existing.ipa = { ...existing.ipa, uk: item.ipa.uk };
      }
      if (!existing.audio?.us && item.audio?.us) {
        existing.audio = { ...existing.audio, us: item.audio.us };
      }
      if (!existing.audio?.uk && item.audio?.uk) {
        existing.audio = { ...existing.audio, uk: item.audio.uk };
      }
    }
  }

  const uniqueList = Array.from(uniqueItemsMap.values());
  const total = uniqueList.length;
  console.log(`Deduped into ${total} unique words (merged parts for duplicate entries).`);

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB:', MONGO_URI);

  const db = mongoose.connection.db;
  const wordCollection = db.collection('words');

  // Clear existing words in collection
  const deleteResult = await wordCollection.deleteMany({});
  console.log(`Cleared previous words in collection: ${deleteResult.deletedCount} removed`);

  // Base timestamp: 2024-01-01 00:00:00 UTC
  // We assign createdAt so that item 0 (at the top of JSON) has the latest createdAt.
  // Therefore, when sorting by { createdAt: -1 }, item 0 appears first.
  const baseTime = new Date('2024-01-01T00:00:00.000Z').getTime();

  // Assign sequential createdAt based on index from top to bottom
  const documentsToInsert = uniqueList.map((item, idx) => {
    const createdAt = new Date(baseTime + (total - idx) * 1000);
    return {
      ...item,
      createdAt,
      updatedAt: createdAt,
    };
  });

  const batchSize = 1000;
  let insertedCount = 0;

  for (let i = 0; i < total; i += batchSize) {
    const batch = documentsToInsert.slice(i, i + batchSize);
    await wordCollection.insertMany(batch, { ordered: true });
    insertedCount += batch.length;
    console.log(`Imported ${insertedCount}/${total} words...`);
  }

  // Ensure indexes for fast sorting and searching
  console.log('Creating indexes...');
  try {
    await wordCollection.createIndex({ createdAt: -1, _id: -1 });
    await wordCollection.createIndex({ word: 1 }, { unique: true });
    await wordCollection.createIndex({ level: 1 });
    await wordCollection.createIndex({ isActive: 1 });
    await wordCollection.createIndex({ isDeleted: 1 });
  } catch (idxErr) {
    console.warn('Index creation warning:', idxErr.message);
  }

  console.log('\n========================================');
  console.log(`Successfully imported ${insertedCount} words into 'words' collection!`);
  console.log('- Removed all id fields');
  console.log('- Merged duplicate words into single documents');
  console.log('- Set createdAt/updatedAt sequentially from top to bottom');
  console.log('- Created database indexes ({ createdAt: -1, _id: -1 }, { word: 1 })');
  console.log('========================================\n');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

importVocabulary().catch((err) => {
  console.error('Import failed with error:', err);
  process.exit(1);
});
