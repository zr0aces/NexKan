import { BookOpen, Circle, Loader2, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Task, TaskStatus } from '@/types/task';
import { cn } from '@/lib/utils';

const COLUMNS: Array<{ status: TaskStatus; label: string; Icon: LucideIcon }> = [
  { status: 'plan',        label: 'Plan',        Icon: BookOpen     },
  { status: 'todo',        label: 'Todo',        Icon: Circle       },
  { status: 'in-progress', label: 'In Progress', Icon: Loader2      },
  { status: 'done',        label: 'Done',        Icon: CheckCircle2 },
];

interface MobileColumnNavProps {
  activeStatus: TaskStatus;
  onStatusChange: (status: TaskStatus) => void;
  tasks: Task[];
}

export function MobileColumnNav({ activeStatus, onStatusChange, tasks }: MobileColumnNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex">
        {COLUMNS.map(({ status, label, Icon }) => {
          const count = tasks.filter(t => t.status === status).length;
          const isActive = status === activeStatus;
          return (
            <button
              key={status}
              onClick={() => onStatusChange(status)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
              <span className={cn(
                'text-[10px] font-semibold tabular-nums',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
