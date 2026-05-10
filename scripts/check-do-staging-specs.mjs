#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = [
  'infra/do/backend.staging.app.yaml',
  'infra/do/portal.staging.app.yaml',
  'infra/do/web.staging.app.yaml',
  'infra/do/studio.staging.app.yaml',
];

const forbidden = [
  'YOUR_DOMAIN',
  'YOUR_ORG',
  'YOUR_REPO',
  'YOUR_ACCOUNT_ID',
  'portal.example.com',
  'app.example.com',
  'studio.example.com',
  'api.example.com',
  'portal-staging.example.com',
  'app-staging.example.com',
  'studio-staging.example.com',
  'api-staging.example.com',
];

const required = [
  'enzocienfuegos-cloud/dusk',
  'codex/s50-staging-rc',
  'portal-staging.duskplatform.co',
  'app-staging.duskplatform.co',
  'studio-staging.duskplatform.co',
  'api-staging.duskplatform.co',
  'cdn-staging.duskplatform.co',
];

const failures = [];

for (const file of files) {
  const absolute = resolve(file);
  const content = readFileSync(absolute, 'utf8');

  for (const token of forbidden) {
    if (content.includes(token)) {
      failures.push(`${file} still contains forbidden placeholder/token: ${token}`);
    }
  }
}

const merged = files.map((file) => readFileSync(resolve(file), 'utf8')).join('\n');
for (const token of required) {
  if (!merged.includes(token)) {
    failures.push(`staging specs are missing required token: ${token}`);
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, files }, null, 2));
