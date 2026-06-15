import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { TaskFilters } from '@nexkan/shared';

const DEFAULT_FILTERS: TaskFilters = {};

export function useTasks(filters: TaskFilters = DEFAULT_FILTERS) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => api.tasks.list(filters),
    staleTime: 30_000,
  });
}

