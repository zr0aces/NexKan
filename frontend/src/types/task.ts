export type TaskStatus = 'plan' | 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  tags: string[];
  due_date?: string;        // YYYY-MM-DD
  sort_order: number;
  created_at: string;
  updated_at: string;
  telegram_message_id?: number;
  attachments: string[];
  description: string;
  notes?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  notes?: string;
  due_date?: string;
  priority?: TaskPriority;
  tags?: string[];
  status?: TaskStatus;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  notes?: string;
  due_date?: string | null;
  priority?: TaskPriority;
  tags?: string[];
}

export interface TaskFilters {
  status?: string;
  tags?: string;
  priority?: TaskPriority;
  search?: string;
  sort?: string;
}
