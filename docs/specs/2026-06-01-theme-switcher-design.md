# Theme Switcher & Mobile Navigation — Design Spec

**Date:** 2026-06-01
**Status:** Approved

---

## Overview

Two UI improvements delivered together:

1. **Theme switcher** — light and dark modes with orange primary. Dark theme follows GitHub's default dark canvas palette. Sun/moon toggle in each page header. Defaults to OS preference; persists to `localStorage`.

2. **Mobile bottom navigation** — on small screens the Kanban board shows one column at a time. A fixed bottom bar with four tabs (Plan, Todo, In Progress, Done) lets users switch between columns. Tablet and desktop retain the existing multi-column grid.

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
| Mobile breakpoint | `< md` (768 px) — one column + bottom nav |
| Default active column (mobile) | `todo` |
| Bottom nav icons | lucide-react: `BookOpen` / `Circle` / `Loader2` / `CheckCircle2` |

---

## Color Tokens

### Light theme (`:root`)

Only primary and ring change from the current defaults.

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
| Modify | `frontend/src/index.css` | Orange primary in `:root`; add `.dark { }` token block |
| Create | `frontend/src/hooks/useTheme.ts` | Theme hook |
| Create | `frontend/src/components/shared/ThemeToggle.tsx` | Sun/Moon toggle button |
| Create | `frontend/src/components/board/MobileColumnNav.tsx` | Bottom nav bar (mobile only) |
| Modify | `frontend/src/components/board/KanbanBoard.tsx` | Active column state; hide inactive columns on mobile; render `MobileColumnNav` |
| Modify | `frontend/index.html` | Inline script to prevent theme flash |
| Modify | `frontend/src/pages/BoardPage.tsx` | Add `<ThemeToggle />` to header; add bottom padding on mobile for nav bar |
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
- `aria-label="Toggle theme"`
- Uses `Sun` and `Moon` from `lucide-react`

---

## Mobile Column Navigation

### `MobileColumnNav` component

`frontend/src/components/board/MobileColumnNav.tsx`

- Props: `activeStatus: TaskStatus`, `onStatusChange: (s: TaskStatus) => void`, `tasks: Task[]`
- Rendered only on mobile (`md:hidden`) — fixed to bottom of viewport
- `z-50`, `border-t`, `bg-background` so it sits above content and respects the active theme
- Four tab buttons, one per status column

Tab layout per button:
```
[Icon]
Label
Count badge
```

| Status | Label | Icon |
|--------|-------|------|
| `plan` | Plan | `BookOpen` |
| `todo` | Todo | `Circle` |
| `in-progress` | In Progress | `Loader2` |
| `done` | Done | `CheckCircle2` |

Active tab: `text-primary` (orange) + small underline indicator. Inactive tabs: `text-muted-foreground`.

Count badge shows number of tasks in that column. Zero count is still shown (not hidden).

### `KanbanBoard` changes

`frontend/src/components/board/KanbanBoard.tsx`

Add state:
```typescript
const [activeColumn, setActiveColumn] = useState<TaskStatus>('todo');
```

Column grid section:
- On `md`+: render all 4 `KanbanColumn` components (existing `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4` layout)
- On `< md`: render only the `KanbanColumn` where `status === activeColumn` (full width)

Responsive approach — wrap each column with a visibility class:
```tsx
<div className={cn(status === activeColumn ? 'block' : 'hidden', 'md:block')}>
  <KanbanColumn ... />
</div>
```

Add `MobileColumnNav` below the grid:
```tsx
<MobileColumnNav
  activeStatus={activeColumn}
  onStatusChange={setActiveColumn}
  tasks={localTasks}
/>
```

### `BoardPage` changes

Add bottom padding on mobile so content is not hidden behind the fixed nav bar:
```tsx
<main className="... pb-20 md:pb-4">
```

---

## Integration Points

**`BoardPage.tsx` header** — add `<ThemeToggle />` between `<RefreshCw>` and `<Button>New Task</Button>`.

**`DashboardPage.tsx` header** — add `<ThemeToggle />` to right side of header.

No changes to `main.tsx`, `App.tsx`, or any backend files.

---

## Tailwind Config

`darkMode: ['class']` already set in `tailwind.config.ts`. No changes needed.

---

## Testing

### Theme

1. Load app with light OS preference → light theme renders
2. Load app with dark OS preference → dark theme renders
3. Click toggle → theme switches, icon updates
4. Reload → stored preference persists
5. Navigate Board ↔ Dashboard → theme persists
6. Toggle overrides OS preference; reload confirms stored value wins

### Mobile navigation

7. At `< 768 px` viewport: only the active column (default `todo`) is visible; bottom nav bar appears
8. Tap each tab → correct column content appears; active tab highlights orange
9. Task count badges match actual tasks per column
10. At `≥ 768 px`: bottom nav hidden; all 4 columns visible in grid
11. Add a task via mobile → it appears in the correct column; count updates
12. Drag-and-drop is disabled on mobile (pointer sensor requires `distance: 8` — still works if user has a mouse attached to a small screen)
