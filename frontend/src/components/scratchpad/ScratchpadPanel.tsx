import { useState, useCallback } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { Note, TaskPriority } from '@nexkan/shared';
import { Button } from '@/components/ui/button';
import { NoteCard } from './NoteCard';
import { ConvertDialog } from './ConvertDialog';
import { useNotes } from '@/hooks/useNotes';
import { useCreateNote, useUpdateNote, useDeleteNote, useConvertNote } from '@/hooks/useNoteMutation';

const EMPTY_NOTES: Note[] = [];

interface ScratchpadPanelProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export function ScratchpadPanel({ isOpen = true, onToggle }: ScratchpadPanelProps) {
  const { data: notes = EMPTY_NOTES, isLoading } = useNotes();
  const [convertTarget, setConvertTarget] = useState<Note | null>(null);

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const convertNote = useConvertNote();

  const handleAdd = useCallback(() => {
    createNote.mutate('New note');
  }, [createNote]);

  const handleUpdate = useCallback((id: string, content: string) => {
    updateNote.mutate({ id, content });
  }, [updateNote]);

  const handleDelete = useCallback((id: string) => {
    deleteNote.mutate(id);
  }, [deleteNote]);

  const handleConvertConfirm = useCallback((id: string, due_date: string, priority?: TaskPriority) => {
    convertNote.mutate({ id, due_date, priority, status: 'todo' });
    setConvertTarget(null);
  }, [convertNote]);


  return (
    <div className="border-t lg:border-t-0 lg:border-l lg:pl-6 border-border pt-4 lg:pt-0 pb-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          {onToggle && (
            <>
              {/* Desktop Chevron (collapse to right) */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-accent hidden lg:flex items-center justify-center rounded-md p-0"
                onClick={onToggle}
                title="Hide Scratchpad"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
              {/* Mobile Chevron (collapse down) */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-accent flex lg:hidden items-center justify-center rounded-md p-0"
                onClick={onToggle}
                title="Hide Scratchpad"
              >
                <ChevronRight className="rotate-90 h-4 w-4 text-muted-foreground" />
              </Button>
            </>
          )}
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Scratchpad
          </h2>
        </div>
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading notes...</p>
      ) : null}

      {!isLoading && notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : null}

      {!isLoading && notes.length > 0 ? (
        <div className="flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto pb-2 lg:pb-0 lg:max-h-[calc(100vh-14rem)] pr-1">
          {notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onConvert={setConvertTarget}
            />
          ))}
        </div>
      ) : null}

      <ConvertDialog
        note={convertTarget}
        open={convertTarget !== null}
        onOpenChange={open => { if (!open) setConvertTarget(null); }}
        onConfirm={handleConvertConfirm}
      />
    </div>
  );
}
