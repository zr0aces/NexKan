import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DeadlineList } from '@/components/dashboard/DeadlineList';
import { OverdueList } from '@/components/dashboard/OverdueList';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { AlertTriangle, Clock, CheckSquare, List } from 'lucide-react';
import { startOfDay, parseISO, isBefore, isEqual, addDays } from 'date-fns';
import { formatDate } from '@/lib/date';

export default function DashboardPage() {
  const { data: tasks = [], isLoading } = useTasks();

  const { overdueTasks, todayTasks, tomorrowTasks, activeTasks, doneTasks, todayLabel, tomorrowLabel } = useMemo(() => {
    const t = startOfDay(new Date());
    const tm = addDays(t, 1);
    return {
      overdueTasks:   tasks.filter(task => task.due_date && task.status !== 'done' && isBefore(startOfDay(parseISO(task.due_date)), t)),
      todayTasks:     tasks.filter(task => task.due_date && task.status !== 'done' && isEqual(startOfDay(parseISO(task.due_date)), t)),
      tomorrowTasks:  tasks.filter(task => task.due_date && task.status !== 'done' && isEqual(startOfDay(parseISO(task.due_date)), tm)),
      activeTasks:    tasks.filter(task => task.status !== 'done'),
      doneTasks:      tasks.filter(task => task.status === 'done'),
      todayLabel:     formatDate(t),
      tomorrowLabel:  formatDate(tm),
    };
  }, [tasks]);

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
      </main>
    </div>
  );
}
