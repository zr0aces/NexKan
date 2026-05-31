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
import { KanbanColumn } from './KanbanColumn';
import { useUpdateTaskStatus, useUpdateTaskOrder } from '@/hooks/useTaskMutation';

const STATUSES: TaskStatus[] = ['plan', 'todo', 'in-progress', 'done'];

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddClick: (status: TaskStatus) => void;
}

export function KanbanBoard({ tasks, onTaskClick, onAddClick }: KanbanBoardProps) {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);

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

  function handleDragStart(_event: DragStartEvent) {
    // No state needed for active item — we use optimistic updates in handleDragOver
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
    if (!over) {
      setLocalTasks(tasks);
      return;
    }

    const activeTask = localTasks.find(t => t.id === active.id);
    if (!activeTask) return;

    const overStatus = STATUSES.find(s => s === over.id);
    const overTask = localTasks.find(t => t.id === over.id);

    if (overStatus && activeTask.status !== overStatus) {
      // Cross-column drop (but we already moved it optimistically in handleDragOver)
      // Find the original task to check its status
      const originalTask = tasks.find(t => t.id === active.id);
      if (originalTask && originalTask.status !== overStatus) {
        try {
          await updateStatus.mutateAsync({ id: activeTask.id, status: overStatus });
        } catch {
          setLocalTasks(tasks);
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUSES.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={getColumnTasks(status)}
            onTaskClick={onTaskClick}
            onAddClick={onAddClick}
          />
        ))}
      </div>
    </DndContext>
  );
}
