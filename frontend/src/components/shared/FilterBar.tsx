import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { TaskFilters } from '@nexkan/shared';

interface FilterBarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
}

export function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  return (
    <div className="flex gap-2 items-center flex-wrap">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          className="pl-9"
          value={filters.search ?? ''}
          onChange={e => onFiltersChange({ ...filters, search: e.target.value || undefined })}
        />
      </div>

      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={filters.priority ?? ''}
        onChange={e => onFiltersChange({ ...filters, priority: (e.target.value as any) || undefined })}
      >
        <option value="">All priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={filters.sort ?? ''}
        onChange={e => onFiltersChange({ ...filters, sort: e.target.value || undefined })}
      >
        <option value="">Default order</option>
        <option value="sort_order:asc">Board order</option>
        <option value="due_date:asc">Due date (asc)</option>
        <option value="due_date:desc">Due date (desc)</option>
        <option value="priority:desc">Priority</option>
        <option value="created_at:desc">Newest first</option>
      </select>
    </div>
  );
}
