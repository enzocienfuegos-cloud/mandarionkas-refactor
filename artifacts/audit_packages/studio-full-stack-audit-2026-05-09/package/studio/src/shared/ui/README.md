# Shared UI Primitives

| Primitive | Semantic intent | Example in Studio |
| --- | --- | --- |
| `Button` | Standard action button with size and emphasis variants. | Save / Export actions |
| `SurfaceButton` | Clickable row/card surface with complex children and no label wrapper. | Scene rows, folder cards, collapsed shell tabs |
| `IconButton` | Icon-only control with accessible label and optional tooltip. | Inspector collapse, rail controls |
| `Tabs` | Switch between distinct panels in the same surface. | Widget inspector tabs |
| `SegmentedControl` | Filter or narrow existing content in place. | Widget library category filter |
| `Tile` | Lightweight framed surface for grouped content. | Inspector/list cards |
| `Tooltip` | Delayed explanatory affordance for controls. | Timeline action buttons |
| `ToastProvider` / `useToast` | Ephemeral system feedback. | Save/export/share confirmations |

## Tooltip policy

- Use `Tooltip` or the `tooltip` prop on `Button` / `IconButton` for interactive hints.
- Use `aria-label` for accessible naming of icon-only or compact controls.
- Avoid raw HTML `title` on interactive editor controls.
- Keep `title` only for semantic HTML requirements like `iframe title` or for non-DOM component props such as chart labels.
