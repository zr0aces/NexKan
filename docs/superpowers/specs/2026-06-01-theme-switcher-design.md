# Theme Switcher — Design Spec

**Date:** 2026-06-01
**Status:** Approved

---

## Overview

Add light and dark theme modes to NexKan. Orange primary color in both themes. Dark theme follows GitHub's default dark canvas style. A sun/moon toggle button in each page header lets users switch themes. Preference persists in `localStorage` and defaults to the OS `prefers-color-scheme` setting.

---

## Decisions

| Decision | Choice |
|----------|--------|
| Theme state | Plain `useTheme` hook (no React Context) |
| Persistence | `localStorage` key `nexkan-theme` |
| Default | `prefers-color-scheme` if no stored value |
| Switcher | Sun/Moon icon toggle button (light ↔ dark) |
| Switcher placement | Both page headers, beside refresh/nav controls |
| Flash prevention | Inline `<script>` in `index.html` applies class before React mounts |
| Dark palette | GitHub dark canvas (`#0d1117` bg, `#161b22` card, `#e6edf3` text) |
| Primary color | Orange `hsl(25 95% 53%)` = `#f97316` in both themes |

---

## Color Tokens

### Light theme (`:root`)

Only the primary and ring change from the current defaults — everything else stays.

```css
--primary:            25 95% 53%;   /* #f97316 orange */
--primary-foreground:  0  0% 100%;  /* white */
--ring:               25 95% 53%;   /* orange focus ring */
```

### Dark theme (`.dark`)

Full token set mirrors GitHub's dark canvas palette.

```css
--background:        215 28%  7%;   /* #0d1117 */
--foreground:        210 17% 94%;   /* #e6edf3 */
--card:              215 21% 11%;   /* #161b22 */
--card-foreground:   210 17% 94%;
--primary:            25 95% 53%;   /* #f97316 orange */
--primary-foreground:  0  0%100%;
--secondary:         210 12% 17%;
--secondary-foreground: 210 17% 94%;
--muted:             210 12% 17%;
--muted-foreground:  210  8% 58%;   /* #8b949e */
--accent:            210 12% 17%;
--accent-foreground: 210 17% 94%;
--destructive:         0 72% 51%;
--destructive-foreground: 210 17% 94%;
--border:            210 12% 21%;   /* #30363d */
--input:             210 12% 21%;
--ring:               25 95% 53%;
--radius:              0.5rem;
```

---

## Architecture

### Files

| Action | File | Description |
|--------|------|-------------|
| Modify | `frontend/src/index.css` | Apply orange to `:root` primary; add `.dark { }` token block |
| Create | `frontend/src/hooks/useTheme.ts` | Theme hook |
| Create | `frontend/src/components/shared/ThemeToggle.tsx` | Toggle button component |
| Modify | `frontend/index.html` | Inline script to prevent flash |
| Modify | `frontend/src/pages/BoardPage.tsx` | Add `<ThemeToggle />` to header |
| Modify | `frontend/src/pages/DashboardPage.tsx` | Add `<ThemeToggle />` to header |

---

## `useTheme` Hook

`frontend/src/hooks/useTheme.ts`

```
State: Theme = 'light' | 'dark'

Init (lazy):
  1. Read localStorage['nexkan-theme']
  2. If 'light' or 'dark' → use it
  3. Else → read window.matchMedia('(prefers-color-scheme: dark)').matches

Effect (runs on theme change):
  - theme === 'dark' → document.documentElement.classList.add('dark')
  - theme === 'light' → document.documentElement.classList.remove('dark')
  - localStorage.setItem('nexkan-theme', theme)

Returns: { theme: Theme, toggleTheme: () => void }
```

---

## Flash Prevention

`frontend/index.html` — inline `<script>` in `<head>` before any CSS or React bundle:

```
Read localStorage['nexkan-theme']:
  If 'dark' → add class 'dark' to <html>
  If 'light' → nothing
  If absent → check prefers-color-scheme dark → add 'dark' if true
```

Runs synchronously before first paint. Eliminates light-flash when user has dark preference.

---

## `ThemeToggle` Component

`frontend/src/components/shared/ThemeToggle.tsx`

- Ghost icon button (matches existing `RefreshCw` button style in headers)
- Dark mode → renders `<Sun>` icon (click → switch to light)
- Light mode → renders `<Moon>` icon (click → switch to dark)
- `aria-label="Toggle theme"` for accessibility
- Uses `Sun` and `Moon` from `lucide-react` (already installed)

---

## Integration Points

**`BoardPage.tsx` header** — add `<ThemeToggle />` between the `<RefreshCw>` button and `<Button>New Task</Button>`.

**`DashboardPage.tsx` header** — add `<ThemeToggle />` to the right side of the header nav bar.

No changes to `main.tsx`, `App.tsx`, or any backend files.

---

## Tailwind Config

`darkMode: ['class']` is already set in `tailwind.config.ts`. No changes needed.

---

## Testing

1. Load app in light OS mode — board renders in light theme
2. Load app in dark OS mode — board renders in dark theme (via `prefers-color-scheme`)
3. Click toggle → switches theme, icon updates, page re-renders
4. Reload page → theme preference persists from `localStorage`
5. Navigate Board ↔ Dashboard — theme persists across navigation
6. Override OS preference via toggle, reload — stored preference wins over OS
