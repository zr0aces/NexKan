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
import { Note, TaskPriority } from '@nexkan/shared';

interface ConvertDialogProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string, due_date: string, priority?: TaskPriority) => void;
}

export function ConvertDialog({ note, open, onOpenChange, onConfirm }: ConvertDialogProps) {
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setDueDate('');
      setPriority('');
      setError('');
    }
  }, [open]);

  function handleConfirm() {
    if (!dueDate) {
      setError('Due date is required');
      return;
    }
    onConfirm(note!.id, dueDate, priority || undefined);
    onOpenChange(false);
  }

  const preview = note?.content.split('\n')[0] ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Convert to Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Task title: <strong className="text-foreground break-all">{preview}</strong>
          </p>
          <p className="text-xs text-muted-foreground">Status will be set to <strong>todo</strong>.</p>
          <div className="space-y-1.5">
            <Label htmlFor="convert-due-date">Due Date *</Label>
            <Input
              id="convert-due-date"
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="convert-priority">Priority</Label>
            <select
              id="convert-priority"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority | '')}
            >
              <option value="">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirm}>Convert</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
