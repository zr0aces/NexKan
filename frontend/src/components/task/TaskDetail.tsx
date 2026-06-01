import { Task, formatDate } from '@nexkan/shared';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { TagBadge } from '@/components/shared/TagBadge';
import { Badge } from '@/components/ui/badge';

interface TaskDetailProps {
  task: Task;
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'Todo',
  'in-progress': 'In Progress',
  done: 'Done',
};

export function TaskDetail({ task }: TaskDetailProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline">{STATUS_LABELS[task.status]}</Badge>
        {task.priority && <PriorityBadge priority={task.priority} />}
      </div>

      {task.due_date && (
        <div className="text-sm">
          <span className="font-medium">Due: </span>
          {formatDate(task.due_date)}
        </div>
      )}

      {task.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {task.tags.map(tag => <TagBadge key={tag} tag={tag} />)}
        </div>
      )}

      {task.description && (
        <div>
          <div className="text-sm font-medium mb-1">Description</div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
        </div>
      )}

      {task.notes && (
        <div>
          <div className="text-sm font-medium mb-1">Notes</div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.notes}</p>
        </div>
      )}
    </div>
  );
}
