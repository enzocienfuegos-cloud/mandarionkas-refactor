import { describe, expect, it } from 'vitest';
import {
  defaultsFromWidgetSchema,
  defineWidgetSchema,
  migrateWidgetSchemaValue,
  validateWidgetSchemaValue,
} from '../../../domain/widget-schema';
import { badgeDefinition } from '../../../widgets/badge/badge.definition';
import { ctaDefinition } from '../../../widgets/cta/cta.definition';
import { imageDefinition } from '../../../widgets/image/image.definition';
import { textDefinition } from '../../../widgets/text/text.definition';
import { FourFacesDefinition } from '../../../widgets/modules/definitions/four-faces.definition';
import { QrCodeDefinition } from '../../../widgets/modules/definitions/qr-code.definition';
import { TikTokVideoDefinition } from '../../../widgets/modules/definitions/tiktok-video.definition';

const heroSchema = defineWidgetSchema({
  version: 3,
  fields: {
    title: { type: 'string', default: 'Hero title', minLength: 1 },
    theme: { type: 'string', default: 'dark', enum: ['dark', 'light'] },
    showBadge: { type: 'boolean', default: true },
    layout: {
      type: 'object',
      shape: {
        columns: { type: 'number', default: 2, min: 1, max: 4, integer: true },
      },
    },
  },
  migrations: [
    {
      fromVersion: 1,
      toVersion: 2,
      migrate: (value) => ({ ...value, showBadge: true }),
    },
    {
      fromVersion: 2,
      toVersion: 3,
      migrate: (value) => ({ ...value, layout: { columns: 2 } }),
    },
  ],
});

describe('widget schema helpers', () => {
  it('builds nested defaults from schema definitions', () => {
    expect(defaultsFromWidgetSchema(heroSchema)).toEqual({
      title: 'Hero title',
      theme: 'dark',
      showBadge: true,
      layout: { columns: 2 },
    });
  });

  it('normalizes invalid values and reports issues', () => {
    const result = validateWidgetSchemaValue(heroSchema, {
      title: 12,
      theme: 'neon',
      showBadge: 'yes',
      layout: { columns: 9 },
    } as unknown as Record<string, unknown>);

    expect(result.valid).toBe(false);
    expect(result.value).toEqual({
      title: 'Hero title',
      theme: 'dark',
      showBadge: true,
      layout: { columns: 4 },
    });
    expect(result.issues.map((issue) => issue.path)).toEqual([
      'title',
      'theme',
      'showBadge',
      'layout.columns',
    ]);
  });

  it('applies sequential migrations up to the latest schema version', () => {
    const result = migrateWidgetSchemaValue(heroSchema, { title: 'Legacy hero' }, 1);

    expect(result.version).toBe(3);
    expect(result.appliedMigrations).toEqual([2, 3]);
    expect(result.value).toEqual({
      title: 'Legacy hero',
      showBadge: true,
      layout: { columns: 2 },
    });
  });

  it('keeps schema-backed default widgets valid for the pilot set', () => {
    const sceneId = 'scene_1';
    const definitions = [badgeDefinition, ctaDefinition, textDefinition, imageDefinition, QrCodeDefinition, FourFacesDefinition, TikTokVideoDefinition];

    definitions.forEach((definition, index) => {
      expect(definition.schema, `${definition.type} should expose a widget schema`).toBeTruthy();
      const widget = definition.defaults(sceneId, index);
      const result = validateWidgetSchemaValue(definition.schema!, widget.props);
      expect(result.valid, `${definition.type} defaults should validate cleanly`).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });
});
