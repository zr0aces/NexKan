import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { Task, TaskStatus, TASK_STATUSES } from '@nexkan/shared';
import { startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { KanbanColumn } from './KanbanColumn';
import { MobileColumnNav } from './MobileColumnNav';
import { useUpdateTaskStatus, useUpdateTaskOrder } from '@/hooks/useTaskMutation';

const STATUSES = TASK_STATUSES;

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddClick: (status: TaskStatus) => void;
}

export function KanbanBoard({ tasks, onTaskClick, onAddClick }: KanbanBoardProps) {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [dragError, setDragError] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<TaskStatus>('todo');
  const [isDragging, setIsDragging] = useState(false);

  const updateStatus = useUpdateTaskStatus();
  const updateOrder = useUpdateTaskOrder();

  const today = useMemo(() => startOfDay(new Date()), []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Sync server state into localTasks, but never during an active drag
  useEffect(() => {
    if (!isDragging) {
      setLocalTasks(tasks);
    }
  }, [tasks, isDragging]);

  const getColumnTasks = useCallback(
    (status: TaskStatus) =>
      localTasks.filter(t => t.status === status).sort((a, b) => a.sort_order - b.sort_order),
    [localTasks]
  );

  function handleDragStart(_event: DragStartEvent) {
    setIsDragging(true);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeTask = localTasks.find(t => t.id === active.id);
    if (!activeTask) return;

    const overStatus = STATUSES.find(s => s === over.id);
    if (overStatus && activeTask.status !== overStatus) {
      setLocalTasks(prev => prev.map(t =>
        t.id === activeTask.id ? { ...t, status: overStatus } : t
      ));
    }
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    // setIsDragging(false) is in finally — fires AFTER all awaits to preserve optimistic state
    try {
      if (!over) {
        setLocalTasks(tasks);
        return;
      }

      const activeTask = localTasks.find(t => t.id === active.id);
      if (!activeTask) return;

      const overStatus = STATUSES.find(s => s === over.id);
      const overTask = localTasks.find(t => t.id === over.id);

      if (overStatus && activeTask.status !== overStatus) {
        const originalTask = tasks.find(t => t.id === active.id);
        if (!originalTask) {
          setLocalTasks(tasks);
          return;
        }
        if (originalTask.status !== overStatus) {
          try {
            await updateStatus.mutateAsync({ id: activeTask.id, status: overStatus });
          } catch (err) {
            setLocalTasks(tasks);
            const msg =
              err instanceof Error && err.message.includes('due_date')
                ? 'Set a due date before moving to this column.'
                : 'Failed to move task.';
            setDragError(msg);
            setTimeout(() => setDragError(null), 3000);
          }
        }
        return;
      }

      if (overTask && overTask.id !== activeTask.id && overTask.status === activeTask.status) {
        const columnTasks = getColumnTasks(activeTask.status);
        const newPosition = columnTasks.findIndex(t => t.id === overTask.id);
        if (newPosition === -1) return;
        try {
          await updateOrder.mutateAsync({ id: activeTask.id, position: newPosition });
        } catch {
          setLocalTasks(tasks);
        }
      }
    } finally {
      setIsDragging(false);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {dragError && (
        <div className="mb-2 px-3 py-2 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
          {dragError}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATUSES.map(status => (
          <div
            key={status}
            className={cn(
              status === activeColumn ? 'block' : 'hidden',
              'md:block'
            )}
          >
            <KanbanColumn
              status={status}
              tasks={getColumnTasks(status)}
              today={today}
              onTaskClick={onTaskClick}
              onAddClick={onAddClick}
            />
          </div>
        ))}
      </div>
      <MobileColumnNav
        activeStatus={activeColumn}
        onStatusChange={setActiveColumn}
        tasks={localTasks}
      />
    </DndContext>
  );
}
