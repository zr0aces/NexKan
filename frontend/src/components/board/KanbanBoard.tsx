import { useState, useCallback } from 'react';
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
import { Task, TaskStatus } from '@/types/task';
import { cn } from '@/lib/utils';
import { KanbanColumn } from './KanbanColumn';
import { MobileColumnNav } from './MobileColumnNav';
import { useUpdateTaskStatus, useUpdateTaskOrder } from '@/hooks/useTaskMutation';

const STATUSES: TaskStatus[] = ['plan', 'todo', 'in-progress', 'done'];

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddClick: (status: TaskStatus) => void;
}

export function KanbanBoard({ tasks, onTaskClick, onAddClick }: KanbanBoardProps) {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [dragError, setDragError] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<TaskStatus>('todo');

  const updateStatus = useUpdateTaskStatus();
  const updateOrder = useUpdateTaskOrder();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Sync with server state
  const tasksKey = tasks.map(t => `${t.id}:${t.sort_order}:${t.status}`).join(',');
  const localKey = localTasks.map(t => `${t.id}:${t.sort_order}:${t.status}`).join(',');
  if (tasksKey !== localKey) {
    setLocalTasks(tasks);
  }

  const getColumnTasks = useCallback(
    (status: TaskStatus) =>
      localTasks.filter(t => t.status === status).sort((a, b) => a.sort_order - b.sort_order),
    [localTasks]
  );

  function handleDragStart(_event: DragStartEvent) {}

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
      if (originalTask && originalTask.status !== overStatus) {
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
