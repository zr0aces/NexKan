import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { TaskDialog } from '@/components/task/TaskDialog';
import { FilterBar } from '@/components/shared/FilterBar';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { Task, TaskFilters, TaskStatus, VERSION } from '@nexkan/shared';
import { ScratchpadPanel } from '@/components/scratchpad/ScratchpadPanel';

const EMPTY_TASKS: Task[] = [];

export default function BoardPage() {
  const [filters, setFilters] = useState<TaskFilters>({ sort: 'sort_order:asc' });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');

  const { data: tasks = EMPTY_TASKS, isLoading, error, refetch } = useTasks(filters);

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  }, []);

  const handleAddClick = useCallback((status: TaskStatus) => {
    setSelectedTask(null);
    setDefaultStatus(status);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) setSelectedTask(null);
  }, []);


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center hover:opacity-90 transition-opacity" title={`NexKan v${VERSION}`}>
              <Logo className="h-6 w-6 text-foreground" />
              <span className="hidden sm:inline font-bold text-xl ml-2 select-none">NexKan</span>
              <span className="hidden sm:inline text-[9px] font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 select-none tracking-wider ml-1.5">
                v{VERSION}
              </span>
            </Link>
            
            <nav className="flex gap-3 ml-1 sm:ml-2">
              <Link to="/" className="text-sm font-medium text-foreground">Board</Link>
              <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-8 w-8">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <Button size="sm" onClick={() => handleAddClick('todo')} className="h-8">
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">New Task</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-16 md:pb-4 space-y-4">
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
            sort={filters.sort}
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
