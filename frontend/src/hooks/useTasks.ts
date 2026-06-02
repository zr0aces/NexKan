import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { TaskFilters } from '@nexkan/shared';

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => api.tasks.list(filters),
    staleTime: 30_000,
  });
}
