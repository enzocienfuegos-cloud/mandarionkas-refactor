import { describe, expect, it } from 'vitest';
import { defaultsFromWidgetSchema, validateWidgetSchemaValue } from '../../../domain/widget-schema';
import { FourFacesDefinition } from '../../../widgets/modules/definitions/four-faces.definition';
import { FOUR_FACES_DEFAULT_PROPS } from '../../../widgets/modules/four-faces.shared';
import { fourFacesSchema } from '../../../widgets/modules/four-faces/schema';

describe('four faces schema', () => {
  it('matches the historical default props byte-for-byte', () => {
    expect(defaultsFromWidgetSchema(fourFacesSchema)).toEqual(FOUR_FACES_DEFAULT_PROPS);
    expect(FourFacesDefinition.defaults('scene_1', 1).props).toEqual(FOUR_FACES_DEFAULT_PROPS);
  });

  it('keeps valid props untouched', () => {
    const result = validateWidgetSchemaValue(fourFacesSchema, {
      ...FOUR_FACES_DEFAULT_PROPS,
      homeTitle: 'Launch offer',
      upTitle: 'Upper face',
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.value.homeTitle).toBe('Launch offer');
    expect(result.value.upTitle).toBe('Upper face');
  });

  it('fills missing props from schema defaults', () => {
    const result = validateWidgetSchemaValue(fourFacesSchema, {
      accentColor: '#123456',
    });

    expect(result.value.homeTitle).toBe(FOUR_FACES_DEFAULT_PROPS.homeTitle);
    expect(result.value.upCtaLabel).toBe(FOUR_FACES_DEFAULT_PROPS.upCtaLabel);
    expect(result.value.accentColor).toBe('#123456');
  });

  it('coerces and bounds numeric props', () => {
    const result = validateWidgetSchemaValue(fourFacesSchema, {
      swipeThreshold: '999',
    });

    expect(result.value.swipeThreshold).toBe(240);
  });

  it('preserves forward-compatible extra props', () => {
    const result = validateWidgetSchemaValue(fourFacesSchema, {
      experimentalFaceMotion: 'spring',
    } as Record<string, unknown>);

    expect(result.value.experimentalFaceMotion).toBe('spring');
  });
});
