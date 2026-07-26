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

  // Adjust height of textarea dynamically to prevent layout shift and scrollbars
  useEffect(() => {
    if (editing && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.focus();
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [editing, draft]);

  function handleBlur() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== note.content.trim()) {
      onUpdate(note.id, trimmed);
    }
  }

  return (
    <div className="group relative bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 dark:border-amber-500/20 rounded-xl p-3 w-52 lg:w-full flex-shrink-0 flex flex-col justify-between gap-2.5 shadow-sm hover:shadow-md transition-all duration-200">
      {editing ? (
        <textarea
          ref={textareaRef}
          className="w-full text-sm bg-transparent resize-none outline-none min-h-[72px] p-0 m-0 border-0 focus:ring-0 focus-visible:ring-0 leading-relaxed font-sans text-foreground overflow-hidden"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
        />
      ) : (
        <p
          className="text-sm whitespace-pre-wrap cursor-text min-h-[72px] break-words p-0 m-0 leading-relaxed font-sans text-foreground/90 hover:text-foreground"
          onClick={() => setEditing(true)}
        >
          {note.content}
        </p>
      )}
      <div className="flex items-center justify-between pt-1 border-t border-amber-500/15">
        <span className="text-[10px] font-mono text-amber-700/70 dark:text-amber-400/60">
          #{note.id}
        </span>
        <div className="flex justify-end gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 rounded-md"
            title="Convert to task"
            onClick={() => onConvert(note)}
          >
            <ArrowRightCircle className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-md"
            title="Delete note"
            onClick={() => onDelete(note.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
});

