import { Circle, Loader2, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Task, TaskStatus } from '@nexkan/shared';
import { cn } from '@/lib/utils';

const COLUMNS: Array<{ status: TaskStatus; label: string; Icon: LucideIcon }> = [
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
  const counts = tasks.reduce<Record<TaskStatus, number>>(
    (acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; },
    { todo: 0, 'in-progress': 0, done: 0 }
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div role="tablist" className="flex">
        {COLUMNS.map(({ status, label, Icon }) => {
          const count = counts[status];
          const isActive = status === activeStatus;
          return (
            <button
              key={status}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onStatusChange(status)}
              className={cn(
                'flex flex-1 flex-col items-center gap-1.5 py-1.5 text-xs transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <div className="flex items-center gap-1 font-medium select-none">
                <span>{label}</span>
                <span className={cn(
                  'text-[9px] px-1.5 py-0.2 rounded-full font-semibold tabular-nums',
                  isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-muted'
                )}>
                  {count}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
