import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Task, TaskStatus, TaskPriority, requiresDueDate } from '@nexkan/shared';
import { TaskDetail } from './TaskDetail';
import { useCreateTask, useUpdateTask, useDeleteTask, useUpdateTaskStatus } from '@/hooks/useTaskMutation';

interface TaskDialogProps {
  task?: Task | null;
  defaultStatus?: TaskStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = 'view' | 'edit' | 'create';

export function TaskDialog({ task, defaultStatus = 'todo', open, onOpenChange }: TaskDialogProps) {
  const [mode, setMode] = useState<Mode>(task ? 'view' : 'create');
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');
  const [priority, setPriority] = useState<TaskPriority | ''>(task?.priority ?? '');
  const [tags, setTags] = useState(task?.tags.join(', ') ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? defaultStatus);
  const [error, setError] = useState('');

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const updateStatus = useUpdateTaskStatus();

  useEffect(() => {
    if (open) {
      setMode(task ? 'view' : 'create');
      setTitle(task?.title ?? '');
      setDescription(task?.description ?? '');
      setNotes(task?.notes ?? '');
      setDueDate(task?.due_date ?? '');
      setPriority(task?.priority ?? '');
      setTags(task?.tags.join(', ') ?? '');
      setStatus(task?.status ?? defaultStatus);
      setError('');
    }
  }, [open, task, defaultStatus]);

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return; }
    if (requiresDueDate(status) && !dueDate) {
      setError(`Due date is required for status "${status}"`);
      return;
    }
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);

    try {
      if (mode === 'create') {
        await createTask.mutateAsync({
          title: title.trim(),
          description: description || undefined,
          notes: notes || undefined,
          due_date: dueDate || undefined,
          priority: (priority as TaskPriority) || undefined,
          tags: tagList,
          status,
        });
      } else if (task) {
        await updateTask.mutateAsync({
          id: task.id,
          input: {
            title: title.trim(),
            description: description || undefined,
            notes: notes || undefined,
            due_date: dueDate || null,
            priority: (priority as TaskPriority) || undefined,
            tags: tagList,
          },
        });
        if (status !== task.status) {
          await updateStatus.mutateAsync({ id: task.id, status, due_date: dueDate || undefined });
        }
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    }
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm(`Delete "${task.title}"?`)) return;
    try {
      await deleteTask.mutateAsync(task.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  const isLoading = createTask.isPending || updateTask.isPending || deleteTask.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'New Task' : mode === 'edit' ? 'Edit Task' : task?.title}
          </DialogTitle>
        </DialogHeader>

        {mode === 'view' && task ? (
          <div className="space-y-4">
            <TaskDetail task={task} />
            <div className="flex gap-2 pt-2">
              <Button onClick={() => setMode('edit')} variant="outline" size="sm">Edit</Button>
              <Button onClick={handleDelete} variant="destructive" size="sm" disabled={isLoading}>Delete</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={status}
                  onChange={e => setStatus(e.target.value as TaskStatus)}
                >
                  <option value="todo">Todo</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={priority}
                  onChange={e => setPriority(e.target.value as TaskPriority | '')}
                >
                  <option value="">None</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input id="due_date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="work, urgent" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Task details..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional notes..."
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? 'Saving...' : mode === 'create' ? 'Create Task' : 'Save Changes'}
              </Button>
              {mode === 'edit' && (
                <Button variant="outline" onClick={() => setMode('view')}>Cancel</Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
