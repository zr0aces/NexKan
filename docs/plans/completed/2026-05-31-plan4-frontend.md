# Frontend Kanban Board — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Plan 1 (Backend Tasks API) must be complete and running on `http://localhost:3000`. The frontend calls `VITE_API_URL` (defaults to `/api` for prod, override in dev).

**Goal:** Build a React + TypeScript Kanban board with drag-and-drop, a dashboard page, task create/edit modal, filtering, and overdue highlighting.

**Architecture:** Vite + React 18 + TypeScript. TanStack Query for server state. `api.ts` wraps all fetch calls. No global state manager — TanStack Query is the only state. Components are pure presentational except for hooks. Built to `frontend/dist/` — served by nginx, no runtime container.

**Tech Stack:** React 18, TypeScript 5, Vite 5, TanStack Query v5, @dnd-kit/core + @dnd-kit/sortable, react-router-dom v6, shadcn/ui (with Radix UI + Tailwind CSS), lucide-react, date-fns

---

### Task 1: Project Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Create frontend/package.json**

```json
{
  "name": "nexkan-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-slot": "^1.1.0",
    "@tanstack/react-query": "^5.51.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.408.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.25.1",
    "tailwind-merge": "^2.4.0",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "typescript": "^5.5.3",
    "vite": "^5.3.4"
  }
}
```

- [ ] **Step 2: Create frontend/tsconfig.json**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

Create `frontend/tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

Create `frontend/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 3: Create frontend/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 4: Create Tailwind config**

Create `frontend/tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

Create `frontend/postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create frontend/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NexKan</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create minimal src/main.tsx and src/App.tsx**

Create `frontend/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

Create `frontend/src/App.tsx`:

```tsx
import { Routes, Route } from 'react-router-dom';
import BoardPage from './pages/BoardPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BoardPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
  );
}
```

Create `frontend/src/index.css`:

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
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
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
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

- [ ] **Step 7: Create placeholder page files**

Create `frontend/src/pages/BoardPage.tsx`:

```tsx
export default function BoardPage() {
  return <div className="p-4">Board Page</div>;
}
```

Create `frontend/src/pages/DashboardPage.tsx`:

```tsx
export default function DashboardPage() {
  return <div className="p-4">Dashboard Page</div>;
}
```

- [ ] **Step 8: Install dependencies and verify build**

```bash
cd frontend && npm install
npm run build
```

Expected: `frontend/dist/` created with `index.html` and assets. No TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold React + Vite + TypeScript frontend"
```

---

### Task 2: Types + API Client

**Files:**
- Create: `frontend/src/types/task.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/utils.ts`

- [ ] **Step 1: Create task types (mirrors backend)**

Create `frontend/src/types/task.ts`:

```typescript
export type TaskStatus = 'plan' | 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  tags: string[];
  due_date?: string;        // YYYY-MM-DD
  sort_order: number;
  created_at: string;
  updated_at: string;
  telegram_message_id?: number;
  attachments: string[];
  description: string;
  notes?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  notes?: string;
  due_date?: string;
  priority?: TaskPriority;
  tags?: string[];
  status?: TaskStatus;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  notes?: string;
  due_date?: string | null;
  priority?: TaskPriority;
  tags?: string[];
}

export interface TaskFilters {
  status?: string;
  tags?: string;
  priority?: TaskPriority;
  search?: string;
  sort?: string;
}
```

- [ ] **Step 2: Create utils.ts**

Create `frontend/src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Create api.ts**

Create `frontend/src/lib/api.ts`:

```typescript
import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from '../types/task';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  tasks: {
    list(filters: TaskFilters = {}): Promise<Task[]> {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== '') params.set(k, String(v));
      });
      const qs = params.toString();
      return request<Task[]>(`/tasks${qs ? `?${qs}` : ''}`);
    },

    get(id: string): Promise<Task> {
      return request<Task>(`/tasks/${id}`);
    },

    create(input: CreateTaskInput): Promise<Task> {
      return request<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    update(id: string, input: UpdateTaskInput): Promise<Task> {
      return request<Task>(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },

    updateStatus(id: string, status: string, due_date?: string): Promise<Task> {
      return request<Task>(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, due_date }),
      });
    },

    updateOrder(id: string, position: number): Promise<Task> {
      return request<Task>(`/tasks/${id}/order`, {
        method: 'PATCH',
        body: JSON.stringify({ position }),
      });
    },

    delete(id: string): Promise<void> {
      return request<void>(`/tasks/${id}`, { method: 'DELETE' });
    },
  },
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npm run build
```

Expected: No errors. `dist/` updated.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/ frontend/src/lib/
git commit -m "feat: add Task types and API client"
```

---

### Task 3: TanStack Query Hooks

**Files:**
- Create: `frontend/src/hooks/useTasks.ts`
- Create: `frontend/src/hooks/useTaskMutation.ts`

- [ ] **Step 1: Create useTasks.ts**

Create `frontend/src/hooks/useTasks.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { TaskFilters } from '../types/task';

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => api.tasks.list(filters),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: () => api.tasks.get(id),
    enabled: Boolean(id),
  });
}
```

- [ ] **Step 2: Create useTaskMutation.ts**

Create `frontend/src/hooks/useTaskMutation.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CreateTaskInput, UpdateTaskInput } from '../types/task';

function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['tasks'] });
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.tasks.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      api.tasks.update(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateTaskStatus() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, status, due_date }: { id: string; status: string; due_date?: string }) =>
      api.tasks.updateStatus(id, status, due_date),
    onSuccess: invalidate,
  });
}

export function useUpdateTaskOrder() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, position }: { id: string; position: number }) =>
      api.tasks.updateOrder(id, position),
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => api.tasks.delete(id),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npm run build
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat: add TanStack Query hooks for tasks"
```

---

### Task 4: Shared UI Components

**Files:**
- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/components/ui/dialog.tsx`
- Create: `frontend/src/components/ui/input.tsx`
- Create: `frontend/src/components/ui/label.tsx`
- Create: `frontend/src/components/ui/select.tsx`
- Create: `frontend/src/components/ui/badge.tsx`
- Create: `frontend/src/components/shared/PriorityBadge.tsx`
- Create: `frontend/src/components/shared/TagBadge.tsx`
- Create: `frontend/src/components/shared/FilterBar.tsx`

These are minimal shadcn/ui-style components using Tailwind + Radix UI. Build only what the Kanban board actually needs.

- [ ] **Step 1: Create button.tsx**

Create `frontend/src/components/ui/button.tsx`:

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';
```

- [ ] **Step 2: Create badge.tsx**

Create `frontend/src/components/ui/badge.tsx`:

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

- [ ] **Step 3: Create input.tsx and label.tsx**

Create `frontend/src/components/ui/input.tsx`:

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';
```

Create `frontend/src/components/ui/label.tsx`:

```tsx
import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;
```

- [ ] **Step 4: Create dialog.tsx**

Create `frontend/src/components/ui/dialog.tsx`:

```tsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2 sm:rounded-lg',
        className
      )}
      {...props}
    >
      {children}
      <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogClose>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose };
```

- [ ] **Step 5: Create PriorityBadge.tsx and TagBadge.tsx**

Create `frontend/src/components/shared/PriorityBadge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { TaskPriority } from '@/types/task';

const priorityStyles: Record<TaskPriority, string> = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200',
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant="outline" className={priorityStyles[priority]}>
      {priority}
    </Badge>
  );
}
```

Create `frontend/src/components/shared/TagBadge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';

export function TagBadge({ tag }: { tag: string }) {
  return (
    <Badge variant="secondary" className="text-xs">
      {tag}
    </Badge>
  );
}
```

- [ ] **Step 6: Create FilterBar.tsx**

Create `frontend/src/components/shared/FilterBar.tsx`:

```tsx
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { TaskFilters } from '@/types/task';

interface FilterBarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
}

export function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  return (
    <div className="flex gap-2 items-center">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          className="pl-9"
          value={filters.search ?? ''}
          onChange={e => onFiltersChange({ ...filters, search: e.target.value || undefined })}
        />
      </div>

      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={filters.priority ?? ''}
        onChange={e => onFiltersChange({ ...filters, priority: (e.target.value as any) || undefined })}
      >
        <option value="">All priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={filters.sort ?? ''}
        onChange={e => onFiltersChange({ ...filters, sort: e.target.value || undefined })}
      >
        <option value="">Default order</option>
        <option value="due_date:asc">Due date (asc)</option>
        <option value="due_date:desc">Due date (desc)</option>
        <option value="priority:desc">Priority</option>
        <option value="created_at:desc">Newest first</option>
      </select>
    </div>
  );
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd frontend && npm run build
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: add shared UI components (badge, button, dialog, input, filter bar)"
```

---

### Task 5: TaskCard + TaskDialog

**Files:**
- Create: `frontend/src/components/task/TaskCard.tsx`
- Create: `frontend/src/components/task/TaskDialog.tsx`
- Create: `frontend/src/components/task/TaskDetail.tsx`

- [ ] **Step 1: Create TaskCard.tsx**

TaskCard renders a single task. Computes overdue client-side: `due_date < today && status !== done` → red border + "Overdue" badge. Uses `useSortable` from dnd-kit.

Create `frontend/src/components/task/TaskCard.tsx`:

```tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, isAfter, startOfDay, parseISO } from 'date-fns';
import { GripVertical, Calendar } from 'lucide-react';
import { Task } from '@/types/task';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { TagBadge } from '@/components/shared/TagBadge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status === 'done') return false;
  return isAfter(startOfDay(new Date()), startOfDay(parseISO(task.due_date)));
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const overdue = isOverdue(task);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow',
        overdue && 'border-red-400 bg-red-50',
        isDragging && 'shadow-lg'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 text-muted-foreground hover:text-foreground cursor-grab"
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{task.title}</span>
            {overdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {task.priority && <PriorityBadge priority={task.priority} />}
            {task.due_date && (
              <span className={cn('flex items-center gap-1 text-xs text-muted-foreground', overdue && 'text-red-600')}>
                <Calendar className="h-3 w-3" />
                {format(parseISO(task.due_date), 'MMM d')}
              </span>
            )}
            {task.tags.slice(0, 2).map(tag => <TagBadge key={tag} tag={tag} />)}
            {task.tags.length > 2 && (
              <span className="text-xs text-muted-foreground">+{task.tags.length - 2}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create TaskDetail.tsx (read-only detail view)**

Create `frontend/src/components/task/TaskDetail.tsx`:

```tsx
import { format, parseISO } from 'date-fns';
import { Task } from '@/types/task';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { TagBadge } from '@/components/shared/TagBadge';
import { Badge } from '@/components/ui/badge';

interface TaskDetailProps {
  task: Task;
}

const STATUS_LABELS: Record<string, string> = {
  plan: 'Plan',
  todo: 'Todo',
  'in-progress': 'In Progress',
  done: 'Done',
};

export function TaskDetail({ task }: TaskDetailProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline">{STATUS_LABELS[task.status]}</Badge>
        {task.priority && <PriorityBadge priority={task.priority} />}
      </div>

      {task.due_date && (
        <div className="text-sm">
          <span className="font-medium">Due: </span>
          {format(parseISO(task.due_date), 'MMMM d, yyyy')}
        </div>
      )}

      {task.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {task.tags.map(tag => <TagBadge key={tag} tag={tag} />)}
        </div>
      )}

      {task.description && (
        <div>
          <div className="text-sm font-medium mb-1">Description</div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
        </div>
      )}

      {task.notes && (
        <div>
          <div className="text-sm font-medium mb-1">Notes</div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.notes}</p>
        </div>
      )}

    </div>
  );
}
```

- [ ] **Step 3: Create TaskDialog.tsx (create/edit modal)**

Create `frontend/src/components/task/TaskDialog.tsx`:

```tsx
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Task, CreateTaskInput, UpdateTaskInput, TaskStatus, TaskPriority } from '@/types/task';
import { TaskDetail } from './TaskDetail';
import { useCreateTask, useUpdateTask, useDeleteTask, useUpdateTaskStatus } from '@/hooks/useTaskMutation';

interface TaskDialogProps {
  task?: Task | null;
  defaultStatus?: TaskStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = 'view' | 'edit' | 'create';

export function TaskDialog({ task, defaultStatus = 'plan', open, onOpenChange }: TaskDialogProps) {
  const [mode, setMode] = useState<Mode>(task ? 'view' : 'create');
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');
  const [priority, setPriority] = useState<TaskPriority | ''>(task?.priority ?? '');
  const [tags, setTags] = useState(task?.tags.join(', ') ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? defaultStatus);
  const [error, setError] = useState('');

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const updateStatus = useUpdateTaskStatus();

  useEffect(() => {
    if (open) {
      setMode(task ? 'view' : 'create');
      setTitle(task?.title ?? '');
      setDescription(task?.description ?? '');
      setNotes(task?.notes ?? '');
      setDueDate(task?.due_date ?? '');
      setPriority(task?.priority ?? '');
      setTags(task?.tags.join(', ') ?? '');
      setStatus(task?.status ?? defaultStatus);
      setError('');
    }
  }, [open, task, defaultStatus]);

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return; }
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);

    try {
      if (mode === 'create') {
        await createTask.mutateAsync({
          title: title.trim(),
          description: description || undefined,
          notes: notes || undefined,
          due_date: dueDate || undefined,
          priority: (priority as TaskPriority) || undefined,
          tags: tagList,
          status,
        });
      } else if (task) {
        await updateTask.mutateAsync({
          id: task.id,
          input: {
            title: title.trim(),
            description: description || undefined,
            notes: notes || undefined,
            due_date: dueDate || null,
            priority: (priority as TaskPriority) || undefined,
            tags: tagList,
          },
        });
        if (status !== task.status) {
          await updateStatus.mutateAsync({ id: task.id, status, due_date: dueDate || undefined });
        }
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    }
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm(`Delete "${task.title}"?`)) return;
    try {
      await deleteTask.mutateAsync(task.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  const isLoading = createTask.isPending || updateTask.isPending || deleteTask.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'New Task' : mode === 'edit' ? 'Edit Task' : task?.title}
          </DialogTitle>
        </DialogHeader>

        {mode === 'view' && task ? (
          <div className="space-y-4">
            <TaskDetail task={task} />
            <div className="flex gap-2 pt-2">
              <Button onClick={() => setMode('edit')} variant="outline" size="sm">Edit</Button>
              <Button onClick={handleDelete} variant="destructive" size="sm" disabled={isLoading}>Delete</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={status}
                  onChange={e => setStatus(e.target.value as TaskStatus)}
                >
                  <option value="plan">Plan</option>
                  <option value="todo">Todo</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={priority}
                  onChange={e => setPriority(e.target.value as TaskPriority | '')}
                >
                  <option value="">None</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input id="due_date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="work, urgent" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Task details..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional notes..."
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? 'Saving...' : mode === 'create' ? 'Create Task' : 'Save Changes'}
              </Button>
              {mode === 'edit' && (
                <Button variant="outline" onClick={() => setMode('view')}>Cancel</Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npm run build
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/task/
git commit -m "feat: add TaskCard, TaskDetail, TaskDialog components"
```

---

### Task 6: Kanban Board Components

**Files:**
- Create: `frontend/src/components/board/KanbanColumn.tsx`
- Create: `frontend/src/components/board/KanbanBoard.tsx`

- [ ] **Step 1: Create KanbanColumn.tsx**

Create `frontend/src/components/board/KanbanColumn.tsx`:

```tsx
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Task, TaskStatus } from '@/types/task';
import { TaskCard } from '@/components/task/TaskCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COLUMN_STYLES: Record<TaskStatus, string> = {
  plan: 'border-t-gray-400',
  todo: 'border-t-blue-400',
  'in-progress': 'border-t-orange-400',
  done: 'border-t-green-400',
};

const COLUMN_LABELS: Record<TaskStatus, string> = {
  plan: 'Plan',
  todo: 'Todo',
  'in-progress': 'In Progress',
  done: 'Done',
};

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddClick: (status: TaskStatus) => void;
}

export function KanbanColumn({ status, tasks, onTaskClick, onAddClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col bg-muted/40 rounded-lg border-t-4 min-h-[400px] p-3',
        COLUMN_STYLES[status],
        isOver && 'bg-muted/60'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">{COLUMN_LABELS[status]}</h2>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onAddClick(status)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
```

- [ ] **Step 2: Create KanbanBoard.tsx**

DragEnd handler:
- Same column drop → `updateOrder(task.id, newPosition)`
- Different column drop → `updateStatus(task.id, newStatus)`

Optimistic update: move card immediately in UI via local state; revert on API error via `onError` in mutation.

Create `frontend/src/components/board/KanbanBoard.tsx`:

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
import { KanbanColumn } from './KanbanColumn';
import { useUpdateTaskStatus, useUpdateTaskOrder } from '@/hooks/useTaskMutation';

const STATUSES: TaskStatus[] = ['plan', 'todo', 'in-progress', 'done'];

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddClick: (status: TaskStatus) => void;
}

export function KanbanBoard({ tasks, onTaskClick, onAddClick }: KanbanBoardProps) {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  const updateStatus = useUpdateTaskStatus();
  const updateOrder = useUpdateTaskOrder();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Sync with server state (when tasks prop changes)
  if (JSON.stringify(tasks.map(t => t.id + t.sort_order + t.status)) !==
      JSON.stringify(localTasks.map(t => t.id + t.sort_order + t.status))) {
    setLocalTasks(tasks);
  }

  const getColumnTasks = useCallback(
    (status: TaskStatus) =>
      localTasks.filter(t => t.status === status).sort((a, b) => a.sort_order - b.sort_order),
    [localTasks]
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeTask = localTasks.find(t => t.id === active.id);
    if (!activeTask) return;

    // If dragged over a column (not a card), move to that column optimistically
    const overStatus = STATUSES.find(s => s === over.id);
    if (overStatus && activeTask.status !== overStatus) {
      setLocalTasks(prev => prev.map(t =>
        t.id === activeTask.id ? { ...t, status: overStatus } : t
      ));
    }
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) {
      setLocalTasks(tasks); // revert
      return;
    }

    const activeTask = localTasks.find(t => t.id === active.id);
    if (!activeTask) return;

    const overStatus = STATUSES.find(s => s === over.id);
    const overTask = localTasks.find(t => t.id === over.id);

    // Cross-column drop
    if (overStatus && activeTask.status !== overStatus) {
      try {
        await updateStatus.mutateAsync({ id: activeTask.id, status: overStatus });
      } catch {
        setLocalTasks(tasks); // revert on error
      }
      return;
    }

    // Same-column reorder
    if (overTask && overTask.status === activeTask.status && overTask.id !== activeTask.id) {
      const columnTasks = getColumnTasks(activeTask.status);
      const newPosition = columnTasks.findIndex(t => t.id === overTask.id);
      if (newPosition === -1) return;
      try {
        await updateOrder.mutateAsync({ id: activeTask.id, position: newPosition });
      } catch {
        setLocalTasks(tasks); // revert on error
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUSES.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={getColumnTasks(status)}
            onTaskClick={onTaskClick}
            onAddClick={onAddClick}
          />
        ))}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 3: Fix missing import in useTaskMutation.ts**

Rename `useUpdateTaskOrder` to match what KanbanBoard imports. Check `frontend/src/hooks/useTaskMutation.ts` — export is `useUpdateTaskOrder`. The import in KanbanBoard uses `useUpdateTaskOrder` — this matches.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npm run build
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/board/
git commit -m "feat: add KanbanColumn and KanbanBoard with dnd-kit drag-and-drop"
```

---

### Task 7: Dashboard Components

**Files:**
- Create: `frontend/src/components/dashboard/StatsCard.tsx`
- Create: `frontend/src/components/dashboard/DeadlineList.tsx`
- Create: `frontend/src/components/dashboard/OverdueList.tsx`

- [ ] **Step 1: Create StatsCard.tsx**

Create `frontend/src/components/dashboard/StatsCard.tsx`:

```tsx
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  className?: string;
}

export function StatsCard({ title, value, icon: Icon, className }: StatsCardProps) {
  return (
    <div className={cn('bg-card border rounded-lg p-4 flex items-center gap-4', className)}>
      <div className="p-2 bg-muted rounded-md">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create DeadlineList.tsx**

Create `frontend/src/components/dashboard/DeadlineList.tsx`:

```tsx
import { format, parseISO } from 'date-fns';
import { Task } from '@/types/task';
import { PriorityBadge } from '@/components/shared/PriorityBadge';

interface DeadlineListProps {
  tasks: Task[];
  title: string;
}

export function DeadlineList({ tasks, title }: DeadlineListProps) {
  if (tasks.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="space-y-2">
        {tasks.map(task => (
          <div key={task.id} className="flex items-center gap-2 text-sm p-2 bg-card border rounded-md">
            <span className="flex-1 truncate">{task.title}</span>
            {task.priority && <PriorityBadge priority={task.priority} />}
            {task.due_date && (
              <span className="text-muted-foreground text-xs whitespace-nowrap">
                {format(parseISO(task.due_date), 'MMM d')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create OverdueList.tsx**

Create `frontend/src/components/dashboard/OverdueList.tsx`:

```tsx
import { format, parseISO } from 'date-fns';
import { Task } from '@/types/task';
import { AlertTriangle } from 'lucide-react';

interface OverdueListProps {
  tasks: Task[];
}

export function OverdueList({ tasks }: OverdueListProps) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No overdue tasks. 🎉</p>;
  }

  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <div key={task.id} className="flex items-center gap-2 text-sm p-2 bg-red-50 border border-red-200 rounded-md">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="flex-1 truncate">{task.title}</span>
          <span className="text-red-600 text-xs whitespace-nowrap">
            {task.due_date ? format(parseISO(task.due_date), 'MMM d') : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npm run build
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/
git commit -m "feat: add dashboard stats, deadline, and overdue list components"
```

---

### Task 8: Board Page + Dashboard Page

**Files:**
- Modify: `frontend/src/pages/BoardPage.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Implement BoardPage.tsx**

Replace `frontend/src/pages/BoardPage.tsx`:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BarChart2, RefreshCw } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { TaskDialog } from '@/components/task/TaskDialog';
import { FilterBar } from '@/components/shared/FilterBar';
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
            <Button size="sm" onClick={() => handleAddClick('plan')}>
              <Plus className="h-4 w-4 mr-1" />
              New Task
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-4 space-y-4">
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

- [ ] **Step 2: Implement DashboardPage.tsx**

Replace `frontend/src/pages/DashboardPage.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DeadlineList } from '@/components/dashboard/DeadlineList';
import { OverdueList } from '@/components/dashboard/OverdueList';
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
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-4">
          <h1 className="text-xl font-bold">NexKan</h1>
          <nav className="flex gap-2">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Board</Link>
            <Link to="/dashboard" className="text-sm font-medium text-foreground">Dashboard</Link>
          </nav>
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

- [ ] **Step 3: Verify TypeScript compiles and build succeeds**

```bash
cd frontend && npm run build
```

Expected: `frontend/dist/` built with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/
git commit -m "feat: implement BoardPage and DashboardPage"
```

---

### Task 9: End-to-End Verification

**Goal:** Confirm the full stack works together — frontend talks to backend, Kanban board is interactive.

- [ ] **Step 1: Start backend**

```bash
cd backend && DATA_DIR=/tmp/nexkan-dev npm run dev &
```

Wait for "NexKan backend running on port 3000".

- [ ] **Step 2: Start frontend dev server**

```bash
cd frontend && npm run dev &
```

Expected: Vite server on `http://localhost:5173` (proxies `/api` to `http://localhost:3000`).

- [ ] **Step 3: Create a test task via curl**

```bash
curl -s -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Test task","status":"todo","due_date":"2099-12-31","description":"A test"}' | python3 -m json.tool
```

Expected: JSON with `id`, `title: "Test task"`, `status: "todo"`.

- [ ] **Step 4: Open browser and verify board renders**

Open `http://localhost:5173` in a browser.

Expected:
- Kanban board visible with 4 columns (Plan, Todo, In Progress, Done)
- "Test task" visible in the Todo column
- No console errors

- [ ] **Step 5: Create a task via UI**

Click "+ New Task" button. Fill in title, status, due date. Click "Create Task".

Expected: Task appears in the correct column immediately (TanStack Query invalidates and refetches).

- [ ] **Step 6: Drag a task between columns**

Drag the test task from Todo to In Progress.

Expected: Task moves to In Progress column. Backend updates (verify: `curl http://localhost:3000/api/tasks` shows updated status).

- [ ] **Step 7: Open task dialog and edit**

Click a task card. Verify detail view shows. Click "Edit". Change title. Click "Save Changes".

Expected: Title updates in board view.

- [ ] **Step 8: Open dashboard**

Navigate to `http://localhost:5173/dashboard`.

Expected: Stats cards show correct counts. Any overdue tasks appear in red.

- [ ] **Step 9: Stop dev servers and build for production**

```bash
kill %1 %2 2>/dev/null; true
cd frontend && npm run build
```

Expected: `frontend/dist/` ready to serve from nginx.

- [ ] **Step 10: Commit**

```bash
git add frontend/
git commit -m "feat: complete frontend Kanban board (board + dashboard + drag-drop)"
```

---

## Plan Complete

After Task 9:
- React Kanban board fully functional
- 4-column drag-and-drop reorder and cross-column moves
- Task create/edit/delete via modal
- Dashboard with stats, overdue list, upcoming deadlines
- Filter by search, priority, sort
- Production build outputs to `frontend/dist/` for nginx

**All 4 plans complete. Ready for docker compose deployment.**
