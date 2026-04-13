import { listMigrationFiles } from '../src/migrations.mjs';

const files = listMigrationFiles();
console.log(JSON.stringify({ migrationCount: files.length, files }, null, 2));
