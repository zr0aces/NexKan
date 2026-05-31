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
