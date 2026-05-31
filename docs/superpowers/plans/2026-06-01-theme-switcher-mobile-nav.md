# Theme Switcher & Mobile Navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add light/dark theme switching with orange primary and GitHub dark palette, plus a mobile bottom nav bar that shows one Kanban column at a time on small screens.

**Architecture:** CSS custom properties drive all colours; Tailwind's `dark:` variant activates the `.dark` class on `<html>`. A plain `useTheme` hook (no context) reads `localStorage` + `prefers-color-scheme`, writes the class, and exposes `toggleTheme`. A fixed `MobileColumnNav` bar replaces the stacked-column layout on `< md` viewports. No new dependencies.

**Tech Stack:** React 18, Tailwind CSS 3 (`darkMode: 'class'`), lucide-react, existing component library.

> **Note:** The frontend has no unit-test framework. Verification for each task is `npm run build` (TypeScript + Vite) rather than a test runner. All commands run from `frontend/`.

---

### Task 1: Orange primary + dark theme CSS tokens

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Replace the entire file with the new token set**

Write `frontend/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 25 95% 53%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 25 95% 53%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 215 28% 7%;
    --foreground: 210 17% 94%;
    --card: 215 21% 11%;
    --card-foreground: 210 17% 94%;
    --primary: 25 95% 53%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 12% 17%;
    --secondary-foreground: 210 17% 94%;
    --muted: 210 12% 17%;
    --muted-foreground: 210 8% 58%;
    --accent: 210 12% 17%;
    --accent-foreground: 210 17% 94%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 210 17% 94%;
    --border: 210 12% 21%;
    --input: 210 12% 21%;
    --ring: 25 95% 53%;
    --radius: 0.5rem;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` — no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add orange primary and GitHub dark color tokens"
```

---

### Task 2: Flash prevention + useTheme hook

**Files:**
- Modify: `frontend/index.html`
- Create: `frontend/src/hooks/useTheme.ts`

- [ ] **Step 1: Add flash-prevention script to index.html**

Replace `frontend/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NexKan</title>
    <script>
      (function () {
        try {
          var stored = localStorage.getItem('nexkan-theme');
          if (stored === 'dark') {
            document.documentElement.classList.add('dark');
          } else if (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
          }
        } catch (_) {}
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create frontend/src/hooks/useTheme.ts**

```typescript
import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'nexkan-theme';

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (_) {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {}
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return { theme, toggleTheme };
}
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` — no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html frontend/src/hooks/useTheme.ts
git commit -m "feat: add useTheme hook and flash-prevention script"
```

---

### Task 3: ThemeToggle component + header wiring

**Files:**
- Create: `frontend/src/components/shared/ThemeToggle.tsx`
- Modify: `frontend/src/pages/BoardPage.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Create ThemeToggle component**

Create `frontend/src/components/shared/ThemeToggle.tsx`:

```tsx
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
```

- [ ] **Step 2: Add ThemeToggle to BoardPage header**

Replace `frontend/src/pages/BoardPage.tsx`:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { TaskDialog } from '@/components/task/TaskDialog';
import { FilterBar } from '@/components/shared/FilterBar';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Task, TaskFilters, TaskStatus } from '@/types/task';

export default function BoardPage() {
  const [filters, setFilters] = useState<TaskFilters>({ sort: 'sort_order:asc' });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('plan');

  const { data: tasks = [], isLoading, error, refetch } = useTasks(filters);

  function handleTaskClick(task: Task) {
    setSelectedTask(task);
    setDialogOpen(true);
  }

  function handleAddClick(status: TaskStatus) {
    setSelectedTask(null);
    setDefaultStatus(status);
    setDialogOpen(true);
  }

  function handleDialogClose(open: boolean) {
    setDialogOpen(open);
    if (!open) setSelectedTask(null);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">NexKan</h1>
            <nav className="flex gap-2">
              <Link to="/" className="text-sm font-medium text-foreground">Board</Link>
              <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <Button size="sm" onClick={() => handleAddClick('plan')}>
              <Plus className="h-4 w-4 mr-1" />
              New Task
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 pt-4 pb-20 md:pb-4 space-y-4">
        <FilterBar filters={filters} onFiltersChange={setFilters} />

        {isLoading && (
          <div className="text-center py-12 text-muted-foreground">Loading tasks...</div>
        )}

        {error && (
          <div className="text-center py-12 text-destructive">
            Failed to load tasks. Is the backend running?
          </div>
        )}

        {!isLoading && !error && (
          <KanbanBoard
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onAddClick={handleAddClick}
          />
        )}
      </main>

      <TaskDialog
        task={selectedTask}
        defaultStatus={defaultStatus}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
      />
    </div>
  );
}
```

Note: `py-4` changed to `pt-4 pb-20 md:pb-4` — reserves space above the fixed mobile nav bar.

- [ ] **Step 3: Add ThemeToggle to DashboardPage header**

Replace `frontend/src/pages/DashboardPage.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DeadlineList } from '@/components/dashboard/DeadlineList';
import { OverdueList } from '@/components/dashboard/OverdueList';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { AlertTriangle, Clock, CheckSquare, List } from 'lucide-react';
import { startOfDay, parseISO, isBefore, isEqual, addDays, format } from 'date-fns';

function today() { return startOfDay(new Date()); }
function tomorrow() { return addDays(today(), 1); }

function isOverdue(dueDate: string, status: string): boolean {
  return status !== 'done' && isBefore(startOfDay(parseISO(dueDate)), today());
}

function isDueToday(dueDate: string): boolean {
  return isEqual(startOfDay(parseISO(dueDate)), today());
}

function isDueTomorrow(dueDate: string): boolean {
  return isEqual(startOfDay(parseISO(dueDate)), tomorrow());
}

export default function DashboardPage() {
  const { data: tasks = [], isLoading } = useTasks();

  const overdueTasks = tasks.filter(t => t.due_date && isOverdue(t.due_date, t.status));
  const todayTasks = tasks.filter(t => t.due_date && isDueToday(t.due_date) && t.status !== 'done');
  const tomorrowTasks = tasks.filter(t => t.due_date && isDueTomorrow(t.due_date) && t.status !== 'done');
  const activeTasks = tasks.filter(t => t.status !== 'done');
  const doneTasks = tasks.filter(t => t.status === 'done');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">NexKan</h1>
            <nav className="flex gap-2">
              <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Board</Link>
              <Link to="/dashboard" className="text-sm font-medium text-foreground">Dashboard</Link>
            </nav>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatsCard title="Overdue" value={overdueTasks.length} icon={AlertTriangle} className={overdueTasks.length > 0 ? 'border-red-200' : ''} />
              <StatsCard title="Due Today" value={todayTasks.length} icon={Clock} />
              <StatsCard title="Active" value={activeTasks.length} icon={List} />
              <StatsCard title="Done" value={doneTasks.length} icon={CheckSquare} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-destructive">Overdue</h2>
                <OverdueList tasks={overdueTasks} />
              </div>

              <div className="space-y-4">
                <DeadlineList tasks={todayTasks} title={`Due Today (${format(today(), 'MMM d')})`} />
                <DeadlineList tasks={tomorrowTasks} title={`Due Tomorrow (${format(tomorrow(), 'MMM d')})`} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` — no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/shared/ThemeToggle.tsx \
        frontend/src/pages/BoardPage.tsx \
        frontend/src/pages/DashboardPage.tsx
git commit -m "feat: add ThemeToggle to both page headers"
```

---

### Task 4: MobileColumnNav component

**Files:**
- Create: `frontend/src/components/board/MobileColumnNav.tsx`

- [ ] **Step 1: Create MobileColumnNav**

Create `frontend/src/components/board/MobileColumnNav.tsx`:

```tsx
import { BookOpen, Circle, Loader2, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Task, TaskStatus } from '@/types/task';
import { cn } from '@/lib/utils';

const COLUMNS: Array<{ status: TaskStatus; label: string; Icon: LucideIcon }> = [
  { status: 'plan',        label: 'Plan',        Icon: BookOpen     },
  { status: 'todo',        label: 'Todo',        Icon: Circle       },
  { status: 'in-progress', label: 'In Progress', Icon: Loader2      },
  { status: 'done',        label: 'Done',        Icon: CheckCircle2 },
];

interface MobileColumnNavProps {
  activeStatus: TaskStatus;
  onStatusChange: (status: TaskStatus) => void;
  tasks: Task[];
}

export function MobileColumnNav({ activeStatus, onStatusChange, tasks }: MobileColumnNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex">
        {COLUMNS.map(({ status, label, Icon }) => {
          const count = tasks.filter(t => t.status === status).length;
          const isActive = status === activeStatus;
          return (
            <button
              key={status}
              onClick={() => onStatusChange(status)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
              <span className={cn(
                'text-[10px] font-semibold tabular-nums',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` — no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/board/MobileColumnNav.tsx
git commit -m "feat: add MobileColumnNav bottom bar component"
```

---

### Task 5: Wire MobileColumnNav into KanbanBoard

**Files:**
- Modify: `frontend/src/components/board/KanbanBoard.tsx`

- [ ] **Step 1: Replace KanbanBoard.tsx**

Replace `frontend/src/components/board/KanbanBoard.tsx`:

```tsx
import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { Task, TaskStatus } from '@/types/task';
import { cn } from '@/lib/utils';
import { KanbanColumn } from './KanbanColumn';
import { MobileColumnNav } from './MobileColumnNav';
import { useUpdateTaskStatus, useUpdateTaskOrder } from '@/hooks/useTaskMutation';

const STATUSES: TaskStatus[] = ['plan', 'todo', 'in-progress', 'done'];

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddClick: (status: TaskStatus) => void;
}

export function KanbanBoard({ tasks, onTaskClick, onAddClick }: KanbanBoardProps) {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [dragError, setDragError] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<TaskStatus>('todo');

  const updateStatus = useUpdateTaskStatus();
  const updateOrder = useUpdateTaskOrder();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Sync with server state
  const tasksKey = tasks.map(t => `${t.id}:${t.sort_order}:${t.status}`).join(',');
  const localKey = localTasks.map(t => `${t.id}:${t.sort_order}:${t.status}`).join(',');
  if (tasksKey !== localKey) {
    setLocalTasks(tasks);
  }

  const getColumnTasks = useCallback(
    (status: TaskStatus) =>
      localTasks.filter(t => t.status === status).sort((a, b) => a.sort_order - b.sort_order),
    [localTasks]
  );

  function handleDragStart(_event: DragStartEvent) {}

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeTask = localTasks.find(t => t.id === active.id);
    if (!activeTask) return;

    const overStatus = STATUSES.find(s => s === over.id);
    if (overStatus && activeTask.status !== overStatus) {
      setLocalTasks(prev => prev.map(t =>
        t.id === activeTask.id ? { ...t, status: overStatus } : t
      ));
    }
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) {
      setLocalTasks(tasks);
      return;
    }

    const activeTask = localTasks.find(t => t.id === active.id);
    if (!activeTask) return;

    const overStatus = STATUSES.find(s => s === over.id);
    const overTask = localTasks.find(t => t.id === over.id);

    if (overStatus && activeTask.status !== overStatus) {
      const originalTask = tasks.find(t => t.id === active.id);
      if (originalTask && originalTask.status !== overStatus) {
        try {
          await updateStatus.mutateAsync({ id: activeTask.id, status: overStatus });
        } catch (err) {
          setLocalTasks(tasks);
          const msg =
            err instanceof Error && err.message.includes('due_date')
              ? 'Set a due date before moving to this column.'
              : 'Failed to move task.';
          setDragError(msg);
          setTimeout(() => setDragError(null), 3000);
        }
      }
      return;
    }

    if (overTask && overTask.id !== activeTask.id && overTask.status === activeTask.status) {
      const columnTasks = getColumnTasks(activeTask.status);
      const newPosition = columnTasks.findIndex(t => t.id === overTask.id);
      if (newPosition === -1) return;
      try {
        await updateOrder.mutateAsync({ id: activeTask.id, position: newPosition });
      } catch {
        setLocalTasks(tasks);
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {dragError && (
        <div className="mb-2 px-3 py-2 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
          {dragError}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUSES.map(status => (
          <div
            key={status}
            className={cn(
              status === activeColumn ? 'block' : 'hidden',
              'md:block'
            )}
          >
            <KanbanColumn
              status={status}
              tasks={getColumnTasks(status)}
              onTaskClick={onTaskClick}
              onAddClick={onAddClick}
            />
          </div>
        ))}
      </div>
      <MobileColumnNav
        activeStatus={activeColumn}
        onStatusChange={setActiveColumn}
        tasks={localTasks}
      />
    </DndContext>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` — no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/board/KanbanBoard.tsx
git commit -m "feat: wire MobileColumnNav into KanbanBoard with active column state"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Start backend**

```bash
cd /path/to/NexKan/backend && DATA_DIR=/tmp/nexkan-theme-test npm run dev &
sleep 4
curl -s http://localhost:3000/api/tasks   # Expected: []
```

- [ ] **Step 2: Start frontend dev server**

```bash
cd /path/to/NexKan/frontend && npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/   # Expected: 200
```

- [ ] **Step 3: Verify theme toggle (light OS)**

Open `http://localhost:5173` in a browser with light OS appearance.

Check:
- Board renders with light background and orange primary buttons
- Click the moon icon in the header → page switches to dark GitHub theme
- Click the sun icon → returns to light
- Reload → dark theme persists (localStorage)

- [ ] **Step 4: Verify theme toggle (dark OS)**

Set OS to dark mode. Clear `localStorage` (`localStorage.removeItem('nexkan-theme')` in DevTools).

Reload → board opens in dark theme automatically (OS preference).

- [ ] **Step 5: Verify mobile navigation**

Resize browser to 375px width (or use DevTools mobile emulation).

Check:
- Only the "Todo" column is visible (default active column)
- Bottom nav bar appears with 4 tabs: Plan, Todo, In Progress, Done
- Tap "Plan" tab → Plan column content replaces Todo column
- Task counts on tabs match actual tasks
- At 768px+ → all 4 columns appear, bottom nav disappears

- [ ] **Step 6: Stop processes and clean up**

```bash
kill %1 %2 2>/dev/null || true
rm -rf /tmp/nexkan-theme-test
```

- [ ] **Step 7: Production build check**

```bash
cd /path/to/NexKan/frontend && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.
