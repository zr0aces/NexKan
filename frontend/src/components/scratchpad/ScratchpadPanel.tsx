import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Note, TaskPriority } from '@nexkan/shared';
import { Button } from '@/components/ui/button';
import { NoteCard } from './NoteCard';
import { ConvertDialog } from './ConvertDialog';
import { useNotes } from '@/hooks/useNotes';
import { useCreateNote, useUpdateNote, useDeleteNote, useConvertNote } from '@/hooks/useNoteMutation';

export function ScratchpadPanel() {
  const { data: notes = [], isLoading } = useNotes();
  const [convertTarget, setConvertTarget] = useState<Note | null>(null);

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const convertNote = useConvertNote();

  function handleAdd() {
    createNote.mutate('New note');
  }

  function handleUpdate(id: string, content: string) {
    updateNote.mutate({ id, content });
  }

  function handleDelete(id: string) {
    deleteNote.mutate(id);
  }

  function handleConvertConfirm(id: string, due_date: string, priority?: TaskPriority) {
    convertNote.mutate({ id, due_date, priority, status: 'todo' });
    setConvertTarget(null);
  }

  return (
    <div className="border-t pt-4 pb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Scratchpad
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={createNote.isPending}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Note
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading notes...</p>
      )}

      {!isLoading && notes.length === 0 && (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      )}

      {!isLoading && notes.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onConvert={n => setConvertTarget(n)}
            />
          ))}
        </div>
      )}

      <ConvertDialog
        note={convertTarget}
        open={convertTarget !== null}
        onOpenChange={open => { if (!open) setConvertTarget(null); }}
        onConfirm={handleConvertConfirm}
      />
    </div>
  );
}
