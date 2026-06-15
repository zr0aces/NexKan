import { memo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, formatDate, isOverdue } from '@nexkan/shared';
import { GripVertical, Calendar } from 'lucide-react';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { TagBadge } from '@/components/shared/TagBadge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  today: Date;
  onClick?: (task: Task) => void;
}

export const TaskCard = memo(function TaskCard({ task, today, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const overdue = task.due_date ? isOverdue(task.due_date, task.status, today) : false;

  const handleClick = useCallback(() => {
    onClick?.(task);
  }, [onClick, task]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-card border rounded-lg p-2.5 sm:p-3 cursor-pointer hover:shadow-md transition-shadow',
        overdue && 'border-destructive bg-destructive/10',
        isDragging && 'shadow-lg'
      )}
      onClick={handleClick}
    >

      <div className="flex items-start gap-2">
        <div
          aria-label="Drag handle"
          className="mt-0.5 text-muted-foreground hover:text-foreground cursor-grab focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.stopPropagation();
            }
          }}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{task.title}</span>
            {overdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {task.priority && <PriorityBadge priority={task.priority} />}
            {task.due_date && (
              <span className={cn('flex items-center gap-1 text-xs text-muted-foreground', overdue && 'text-destructive')}>
                <Calendar className="h-3 w-3" />
                {formatDate(task.due_date)}
              </span>
            )}
            {task.tags.slice(0, 2).map(tag => <TagBadge key={tag} tag={tag} />)}
            {task.tags.length > 2 && (
              <span className="text-xs text-muted-foreground">+{task.tags.length - 2}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

