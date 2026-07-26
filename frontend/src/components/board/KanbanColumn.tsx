import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Task, TaskStatus } from '@nexkan/shared';
import { TaskCard } from '@/components/task/TaskCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COLUMN_STYLES: Record<TaskStatus, { border: string; badge: string; dot: string }> = {
  todo: {
    border: 'border-t-cyan-500/80 dark:border-t-cyan-400',
    badge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
    dot: 'bg-cyan-500',
  },
  'in-progress': {
    border: 'border-t-amber-500/80 dark:border-t-amber-400',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  done: {
    border: 'border-t-emerald-500/80 dark:border-t-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
};

const COLUMN_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Done',
};

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  today: Date;
  onTaskClick: (task: Task) => void;
  onAddClick: (status: TaskStatus) => void;
}

export const KanbanColumn = memo(function KanbanColumn({ status, tasks, today, onTaskClick, onAddClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const styleConfig = COLUMN_STYLES[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col bg-muted/30 dark:bg-card/40 rounded-xl border border-border/60 border-t-4 min-h-[420px] p-3 sm:p-4 backdrop-blur-sm transition-all duration-200',
        styleConfig.border,
        isOver && 'bg-primary/5 ring-2 ring-primary/30 border-primary/40'
      )}
    >
      <div className="flex items-center justify-between mb-3.5 px-0.5">
        <div className="flex items-center gap-2.5">
          <span className={cn('h-2 w-2 rounded-full', styleConfig.dot)} />
          <h2 className="font-display font-semibold text-sm tracking-tight text-foreground">
            {COLUMN_LABELS[status]}
          </h2>
          <span className={cn('text-xs font-mono font-medium rounded-full px-2 py-0.5 border', styleConfig.badge)}>
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
          onClick={() => onAddClick(status)}
          title={`Add task to ${COLUMN_LABELS[status]}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} today={today} onClick={onTaskClick} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
});

