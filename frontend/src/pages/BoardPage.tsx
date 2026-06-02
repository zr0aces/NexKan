import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { TaskDialog } from '@/components/task/TaskDialog';
import { FilterBar } from '@/components/shared/FilterBar';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { Task, TaskFilters, TaskStatus } from '@nexkan/shared';
import { ScratchpadPanel } from '@/components/scratchpad/ScratchpadPanel';

export default function BoardPage() {
  const [filters, setFilters] = useState<TaskFilters>({ sort: 'sort_order:asc' });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');

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
            <Link to="/" className="flex items-center gap-2 font-bold text-xl text-foreground hover:opacity-90 transition-opacity">
              <Logo className="h-6 w-6 text-foreground" />
              <span>NexKan</span>
            </Link>
            <nav className="flex gap-2 ml-2">
              <Link to="/" className="text-sm font-medium text-foreground">Board</Link>
              <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <Button size="sm" onClick={() => handleAddClick('todo')}>
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

        <ScratchpadPanel />
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
