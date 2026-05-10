import type { WidgetSchemaDefinition } from './types';

export type WidgetSchemaMigrationResult = {
  value: Record<string, unknown>;
  version: number;
  appliedMigrations: number[];
};

export function migrateWidgetSchemaValue(
  schema: WidgetSchemaDefinition,
  value: Record<string, unknown>,
  fromVersion: number,
): WidgetSchemaMigrationResult {
  if (fromVersion > schema.version) {
    throw new Error(`Cannot migrate from schema version ${fromVersion} to older target ${schema.version}.`);
  }

  let currentVersion = fromVersion;
  let currentValue = { ...value };
  const appliedMigrations: number[] = [];
  const migrations = [...(schema.migrations ?? [])].sort((left, right) => left.fromVersion - right.fromVersion);

  while (currentVersion < schema.version) {
    const migration = migrations.find((candidate) => candidate.fromVersion === currentVersion);
    if (!migration) {
      throw new Error(`Missing widget schema migration from version ${currentVersion}.`);
    }
    currentValue = migration.migrate(currentValue);
    currentVersion = migration.toVersion;
    appliedMigrations.push(currentVersion);
  }

  return {
    value: currentValue,
    version: currentVersion,
    appliedMigrations,
  };
}
