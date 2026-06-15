import { useState, useRef, useEffect, memo } from 'react';
import { Trash2, ArrowRightCircle } from 'lucide-react';
import { Note } from '@nexkan/shared';
import { Button } from '@/components/ui/button';

interface NoteCardProps {
  note: Note;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onConvert: (note: Note) => void;
}

export const NoteCard = memo(function NoteCard({ note, onUpdate, onDelete, onConvert }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(note.content);
  }, [note.content]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  function handleBlur() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== note.content.trim()) {
      onUpdate(note.id, trimmed);
    }
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2.5 sm:p-3 w-48 sm:w-52 flex-shrink-0 flex flex-col gap-2 shadow-sm">
      {editing ? (
        <textarea
          ref={textareaRef}
          className="w-full text-sm bg-transparent resize-none outline-none min-h-[80px]"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
        />
      ) : (
        <p
          className="text-sm whitespace-pre-wrap cursor-text min-h-[80px] break-words"
          onClick={() => setEditing(true)}
        >
          {note.content}
        </p>
      )}
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="Convert to task"
          onClick={() => onConvert(note)}
        >
          <ArrowRightCircle className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          title="Delete note"
          onClick={() => onDelete(note.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
});

