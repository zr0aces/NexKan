import { Task, formatDate } from '@nexkan/shared';
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
            {task.due_date ? formatDate(task.due_date) : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
