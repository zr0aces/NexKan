import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { TaskPriority, TaskStatus } from '@nexkan/shared';

function useInvalidateNotes() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['notes'] });
}

export function useCreateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (content: string) => api.notes.create(content),
    onSuccess: invalidate,
  });
}

export function useUpdateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.notes.update(id, content),
    onSuccess: invalidate,
  });
}

export function useDeleteNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (id: string) => api.notes.delete(id),
    onSuccess: invalidate,
  });
}

export function useConvertNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      due_date,
      priority,
      status,
    }: {
      id: string;
      due_date?: string;
      priority?: TaskPriority;
      status?: TaskStatus;
    }) => api.notes.convert(id, { due_date, priority, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
