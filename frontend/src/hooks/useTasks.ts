import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { TaskFilters } from '../types/task';

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => api.tasks.list(filters),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: () => api.tasks.get(id),
    enabled: Boolean(id),
  });
}
