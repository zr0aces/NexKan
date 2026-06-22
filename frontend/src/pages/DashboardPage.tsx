import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DeadlineList } from '@/components/dashboard/DeadlineList';
import { OverdueList } from '@/components/dashboard/OverdueList';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Logo } from '@/components/shared/Logo';
import { AlertTriangle, Clock, CheckSquare, List, ChevronLeft, ChevronUp } from 'lucide-react';
import { startOfDay, isEqual, addDays } from 'date-fns';
import { parseLocalDate, formatDate, isOverdue, VERSION, Task } from '@nexkan/shared';
import { ScratchpadPanel } from '@/components/scratchpad/ScratchpadPanel';

const EMPTY_TASKS: Task[] = [];

export default function DashboardPage() {
  const { data: tasks = EMPTY_TASKS, isLoading } = useTasks();

  const [isScratchpadOpen, setIsScratchpadOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('nexkan:scratchpad-open');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('nexkan:scratchpad-open', String(isScratchpadOpen));
  }, [isScratchpadOpen]);


  const { overdueTasks, todayTasks, tomorrowTasks, activeTasks, doneTasks, todayLabel, tomorrowLabel } = useMemo(() => {
    const t = startOfDay(new Date());
    const tm = addDays(t, 1);
    return {
      overdueTasks:   tasks.filter(task => task.due_date !== undefined && isOverdue(task.due_date, task.status, t)),
      todayTasks:     tasks.filter(task => task.due_date && task.status !== 'done' && isEqual(startOfDay(parseLocalDate(task.due_date)), t)),
      tomorrowTasks:  tasks.filter(task => task.due_date && task.status !== 'done' && isEqual(startOfDay(parseLocalDate(task.due_date)), tm)),
      activeTasks:    tasks.filter(task => task.status !== 'done'),
      doneTasks:      tasks.filter(task => task.status === 'done'),
      todayLabel:     formatDate(t),
      tomorrowLabel:  formatDate(tm),
    };
  }, [tasks]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="max-w-screen-xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center hover:opacity-90 transition-opacity" title={`NexKan v${VERSION}`}>
              <Logo className="h-6 w-6 text-foreground" />
              <span className="hidden sm:inline font-bold text-xl ml-2 select-none">NexKan</span>
              <span className="hidden sm:inline text-[9px] font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 select-none tracking-wider ml-1.5">
                v{VERSION}
              </span>
            </Link>
            
            <nav className="flex gap-3 ml-1 sm:ml-2">
              <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Board</Link>
              <Link to="/dashboard" className="text-sm font-medium text-foreground">Dashboard</Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <div className={isScratchpadOpen ? 'lg:col-span-3 space-y-4 sm:space-y-6' : 'lg:col-span-4 space-y-4 sm:space-y-6'}>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatsCard title="Overdue" value={overdueTasks.length} icon={AlertTriangle} className={overdueTasks.length > 0 ? 'border-destructive' : ''} />
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
                    <DeadlineList tasks={todayTasks} title={`Due Today (${todayLabel})`} />
                    <DeadlineList tasks={tomorrowTasks} title={`Due Tomorrow (${tomorrowLabel})`} />
                  </div>
                </div>
              </>
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
    </div>
  );
}
