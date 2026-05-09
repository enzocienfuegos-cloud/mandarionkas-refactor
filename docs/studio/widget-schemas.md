# Widget Schemas

Studio ahora tiene un sistema interno y liviano de schemas para props de widgets en `apps/studio/src/domain/widget-schema/`.

## Qué resuelve

- Defaults declarativos por campo.
- Validación sin dependencias externas.
- Migraciones explícitas por versión.
- Contratos reutilizables desde `WidgetDefinition`.

## API

```ts
import {
  defineWidgetSchema,
  defaultsFromWidgetSchema,
  validateWidgetSchemaValue,
  migrateWidgetSchemaValue,
} from '@/domain/widget-schema';
```

Cada schema declara:

```ts
const ctaSchema = defineWidgetSchema({
  version: 1,
  fields: {
    text: { type: 'string', default: 'Learn more', minLength: 1 },
    url: { type: 'string', default: '' },
  },
});
```

## Tipos soportados

- `string`
- `number`
- `boolean`
- `color`
- `asset-ref`
- `array`
- `object`

## Uso en widget definitions

`WidgetDefinition` acepta ahora `schema?: WidgetSchemaDefinition`.

Patrón recomendado:

```ts
const promoSchema = defineWidgetSchema({
  version: 1,
  fields: {
    title: { type: 'string', default: 'Promo title' },
    accentColor: { type: 'color', default: '#ffffff' },
  },
});

export const PromoDefinition: WidgetDefinition = {
  ...
  defaults: (sceneId, zIndex) => ({
    ...,
    props: defaultsFromWidgetSchema(promoSchema),
  }),
  schema: promoSchema,
};
```

## Migraciones

Cuando un widget necesita evolucionar su shape sin romper documentos legacy:

```ts
const schema = defineWidgetSchema({
  version: 3,
  fields: { ... },
  migrations: [
    { fromVersion: 1, toVersion: 2, migrate: (value) => ({ ...value, showBadge: true }) },
    { fromVersion: 2, toVersion: 3, migrate: (value) => ({ ...value, layout: { columns: 2 } }) },
  ],
});
```

Luego:

```ts
const migrated = migrateWidgetSchemaValue(schema, legacyProps, 1);
const validated = validateWidgetSchemaValue(schema, migrated.value);
```

## Adopción actual

La primera tanda quedó aplicada a:

- `badge`
- `cta`
- `text`
- `image`
- `qr-code`

Esto nos deja un contrato piloto real sin forzar una migración riesgosa sobre todo el catálogo en un solo paso.
