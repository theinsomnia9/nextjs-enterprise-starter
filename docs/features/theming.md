# Theming

Light/dark mode with CSS custom properties, Tailwind `class`-strategy dark mode, and `localStorage` persistence.

## How it works

- `tailwind.config.ts` → `darkMode: ['class']`. Dark styles apply when `<html>` has the `dark` class.
- `src/app/globals.css` defines HSL variables on `:root` (light) and `.dark` (dark) — `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--border`, plus status/priority colors (`--status-*`, `--priority-*`).
- `src/components/theme/ThemeToggle.tsx` toggles the `dark` class on `<html>` and writes the choice to `localStorage`. On first visit it honours `prefers-color-scheme`.
- `src/providers/ThemeProvider.tsx` is a thin context wrapper for components that need to read the current theme.
- Toggle is mounted globally in `src/app/layout.tsx` (top-right fixed position).

## Using theme colors

```tsx
<div className="bg-background text-foreground">
  <h1 className="text-primary">Title</h1>
  <p className="text-muted-foreground">Body</p>
</div>
```

Status/priority utility classes are wired in the Tailwind config, e.g. `bg-status-pending`, `text-priority-p1`.

## Swapping the palette

Edit the HSL values on `:root` and `.dark` in `globals.css`. Presets the project has shipped at various points:

**Modern neutral (current).** Slate grays + ocean blue.
```css
:root { --primary: 221 83% 53%; ... }
.dark { --primary: 217 91% 60%; ... }
```

**Ocean deep.** Deeper, more saturated blues.
```css
:root { --primary: 224 76% 48%; }
.dark { --primary: 213 94% 68%; }
```

**Warm neutral.** Amber primary.
```css
:root { --primary: 25 95% 53%; }
.dark { --primary: 35 92% 60%; }
```

**Forest green.**
```css
:root { --primary: 142 76% 36%; }
.dark { --primary: 142 71% 50%; }
```

Restart the dev server after edits.

## Tests

- Unit: `__tests__/unit/components/theme/ThemeToggle.test.tsx`
- E2E: `__tests__/e2e/theme.spec.ts`
- `window.matchMedia` is mocked in `__tests__/setup/vitest.setup.ts`.

## Known quirk

The default state on first render is `light`; an effect then flips to `dark` if the user prefers it, producing a brief flash. To eliminate, set the class via an inline `<head>` script or cookie before hydration, or adopt `next-themes`.
