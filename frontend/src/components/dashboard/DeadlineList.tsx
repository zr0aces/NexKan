import { Task } from '@/types/task';
import { formatDate } from '@/lib/date';
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
                {formatDate(task.due_date)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
