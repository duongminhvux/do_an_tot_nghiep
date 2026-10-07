import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { NextConfig } from 'next';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(rootEnvPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(rootEnvPath);
}

const nextConfig: NextConfig = {};

export default nextConfig;
