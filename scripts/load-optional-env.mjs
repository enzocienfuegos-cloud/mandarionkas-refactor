import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex <= 0) return null;
  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

export function loadOptionalEnvFile(path = '.env') {
  const absolutePath = resolve(process.cwd(), path);
  if (!existsSync(absolutePath)) return false;
  const raw = readFileSync(absolutePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const entry = parseEnvLine(line);
    if (!entry) continue;
    if (!(entry.key in process.env)) {
      process.env[entry.key] = entry.value;
    }
  }
  return true;
}
