import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CreateTaskInput, UpdateTaskInput } from '../types/task';

function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['tasks'] });
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.tasks.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      api.tasks.update(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateTaskStatus() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, status, due_date }: { id: string; status: string; due_date?: string }) =>
      api.tasks.updateStatus(id, status, due_date),
    onSuccess: invalidate,
  });
}

export function useUpdateTaskOrder() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, position }: { id: string; position: number }) =>
      api.tasks.updateOrder(id, position),
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => api.tasks.delete(id),
    onSuccess: invalidate,
  });
}
