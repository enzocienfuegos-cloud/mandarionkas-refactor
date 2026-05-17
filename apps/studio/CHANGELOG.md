# Changelog

## 2026-05-17

### Animation engine v1

- Reemplazado el path principal de motion por un `AnimationEngine` único con GSAP para editor, client preview y export runtime.
- Normalizado `WidgetMotion` a slots `enter`, `idle` y `exit`, con triggers y replay policies formales.
- Eliminada la generación de managed keyframes para presets nuevos.
- Migrado el export runtime a bundle compilado consumido por `compileRuntime(...)`.
- Corregido el reveal de scratch para no ocultar el contenedor revelado con `display: none`.
- Agregada cobertura visual Playwright para 10 escenarios mínimos del engine en `tests/visual/animation-engine.spec.ts`.
