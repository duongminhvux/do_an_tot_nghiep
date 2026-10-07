import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_ENV_PATH = path.resolve(__dirname, '../../../../.env');

function parseEnvValue(rawValue) {
  let value = rawValue.trim();

  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }

  return value.replace(/\\n/g, '\n');
}

export function loadRootEnv() {
  if (!fs.existsSync(ROOT_ENV_PATH)) {
    return false;
  }

  const envContent = fs.readFileSync(ROOT_ENV_PATH, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    const rawValue = trimmed.slice(separatorIndex + 1);
    process.env[key] = parseEnvValue(rawValue);
  }

  return true;
}
