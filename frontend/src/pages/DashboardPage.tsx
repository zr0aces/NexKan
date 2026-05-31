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
