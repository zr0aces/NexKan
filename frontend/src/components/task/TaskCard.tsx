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
        'group relative bg-card border border-border/80 rounded-xl p-3 cursor-pointer shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200 hover:-translate-y-0.5',
        overdue && 'border-destructive/60 bg-destructive/5 hover:border-destructive',
        isDragging && 'shadow-xl ring-2 ring-primary/40 rotate-1 scale-[1.02] z-50 opacity-90'
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-2.5">
        <div
          aria-label="Drag handle"
          className="mt-0.5 p-1 text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md hover:bg-accent transition-colors"
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
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="font-mono text-[10px] text-muted-foreground/70 bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 select-none">
                #{task.id}
              </span>
              <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
                {task.title}
              </h3>
            </div>
            {overdue && (
              <Badge variant="destructive" className="text-[10px] uppercase font-mono tracking-wider shrink-0 px-1.5 py-0">
                Overdue
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {task.priority && <PriorityBadge priority={task.priority} />}
            {task.due_date && (
              <span
                className={cn(
                  'flex items-center gap-1 text-xs font-mono text-muted-foreground',
                  overdue && 'text-destructive font-medium'
                )}
              >
                <Calendar className="h-3 w-3" />
                {formatDate(task.due_date)}
              </span>
            )}
            {task.tags.slice(0, 2).map(tag => (
              <TagBadge key={tag} tag={tag} />
            ))}
            {task.tags.length > 2 && (
              <span className="text-[10px] font-mono text-muted-foreground/80 bg-muted px-1.5 py-0.5 rounded">
                +{task.tags.length - 2}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

