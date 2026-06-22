import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, ChevronLeft, ChevronUp } from 'lucide-react';
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

  const [isScratchpadOpen, setIsScratchpadOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('nexkan:scratchpad-open');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('nexkan:scratchpad-open', String(isScratchpadOpen));
  }, [isScratchpadOpen]);

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

      <main className="max-w-screen-2xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-16 md:pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <div className={isScratchpadOpen ? 'lg:col-span-3 space-y-4' : 'lg:col-span-4 space-y-4'}>
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
          </div>

          {isScratchpadOpen && (
            <div className="lg:col-span-1 lg:sticky lg:top-20">
              <ScratchpadPanel isOpen={isScratchpadOpen} onToggle={() => setIsScratchpadOpen(false)} />
            </div>
          )}
        </div>

        {!isScratchpadOpen && (
          <>
            {/* Desktop Sticky Tab */}
            <button
              onClick={() => setIsScratchpadOpen(true)}
              className="fixed right-0 top-1/2 -translate-y-1/2 bg-yellow-50 dark:bg-yellow-950 border border-r-0 border-yellow-200 dark:border-yellow-800 rounded-l-lg py-4 px-2 shadow-md cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-all duration-200 flex flex-col items-center gap-2 group z-50 hidden lg:flex"
              title="Show Scratchpad"
            >
              <ChevronLeft className="h-4 w-4 text-yellow-800 dark:text-yellow-200 group-hover:-translate-x-0.5 transition-transform" />
              <span className="[writing-mode:vertical-rl] text-xs font-bold tracking-widest text-yellow-800 dark:text-yellow-200 uppercase select-none">
                Scratchpad
              </span>
            </button>

            {/* Mobile Floating Action Button */}
            <button
              onClick={() => setIsScratchpadOpen(true)}
              className="fixed bottom-6 right-6 bg-yellow-100 dark:bg-yellow-950 border border-yellow-300 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 h-12 w-12 rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-all z-50 flex lg:hidden animate-in fade-in zoom-in duration-200"
              title="Show Scratchpad"
            >
              <ChevronUp className="h-6 w-6 text-yellow-800 dark:text-yellow-200" />
            </button>
          </>
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
