# Module View Model

La capa `Module View Model` existe para que `stage` y `export` consuman la misma semántica visual antes de migrar widgets concretos.

## Qué incluye

- `types.ts`: contratos base para `ModuleSkin`, `ModuleViewModel` y `ModuleRenderSurface`.
- `module-tokens.ts`: resolución pura de skin, tokens, classNames y CSS vars.
- `create-module-view-model.ts`: helper genérico para transformar `props + style` en datos renderizables.
- `module-style-recipe.ts`: recipes puras para generar estilos de `stage` o strings CSS de `export`.

## Principio

`stage` y `export` pueden tener renderers distintos, pero deben compartir:

- skin resuelta
- tokens resueltos
- recipes de estilo
- datos derivados del módulo

Si un widget termina con colores, radios o jerarquía visual distinta entre surfaces, la divergencia ya no es “normal”: es un bug verificable.

## Uso base

```ts
import {
  createModuleViewModel,
  styleFromRecipe,
} from '../../apps/studio/src/widgets/modules/view-model';

const vm = createModuleViewModel(
  {
    type: 'travel-deal',
    props: { title: 'Weekend fare', price: '$199' },
    style: { moduleSurface: 'commerce', moduleTone: 'brand' },
    surface: 'stage',
  },
  (props) => ({
    title: props.title,
    eyebrow: 'Limited seats',
    priceLabel: props.price,
  }),
);

const stageRootStyle = styleFromRecipe(vm, 'root', 'stage');
const exportRootStyle = styleFromRecipe(vm, 'root', 'export');
```

## Próximo paso

La siguiente iteración debe conectar esta base con el framework de parity tests y luego migrar widgets piloto como `badge`, `cta`, `image`, `text` y `qr-code`.
