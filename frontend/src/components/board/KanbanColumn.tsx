import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Task, TaskStatus } from '@nexkan/shared';
import { TaskCard } from '@/components/task/TaskCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COLUMN_STYLES: Record<TaskStatus, string> = {
  todo: 'border-t-blue-400',
  'in-progress': 'border-t-orange-400',
  done: 'border-t-green-400',
};

const COLUMN_LABELS: Record<TaskStatus, string> = {
  todo: 'Todo',
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

export function KanbanColumn({ status, tasks, today, onTaskClick, onAddClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col bg-muted/40 rounded-lg border-t-4 min-h-[350px] p-2.5 sm:p-3',
        COLUMN_STYLES[status],
        isOver && 'bg-muted/60'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">{COLUMN_LABELS[status]}</h2>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onAddClick(status)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} today={today} onClick={() => onTaskClick(task)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
