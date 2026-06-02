import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DeadlineList } from '@/components/dashboard/DeadlineList';
import { OverdueList } from '@/components/dashboard/OverdueList';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Logo } from '@/components/shared/Logo';
import { AlertTriangle, Clock, CheckSquare, List } from 'lucide-react';
import { startOfDay, isEqual, addDays } from 'date-fns';
import { parseLocalDate, formatDate, isOverdue, VERSION } from '@nexkan/shared';
import { ScratchpadPanel } from '@/components/scratchpad/ScratchpadPanel';

export default function DashboardPage() {
  const { data: tasks = [], isLoading } = useTasks();

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
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl text-foreground hover:opacity-90 transition-opacity">
              <Logo className="h-6 w-6 text-foreground" />
              <div className="flex items-baseline gap-1.5">
                <span>NexKan</span>
                <span className="text-[9px] font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 select-none tracking-wider">
                  v{VERSION}
                </span>
              </div>
            </Link>
            
            <nav className="hidden sm:flex gap-2 ml-2">
              <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Board</Link>
              <Link to="/dashboard" className="text-sm font-medium text-foreground">Dashboard</Link>
            </nav>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <nav className="flex sm:hidden gap-4">
              <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Board</Link>
              <Link to="/dashboard" className="text-sm font-medium text-foreground">Dashboard</Link>
            </nav>
            
            <div className="ml-auto sm:ml-0">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
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

        <ScratchpadPanel />
      </main>
    </div>
  );
}
