export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  tags: string[];
  due_date?: string;            // YYYY-MM-DD
  sort_order: number;
  created_at: string;           // ISO 8601
  updated_at: string;           // ISO 8601
  telegram_message_id?: number;
  attachments: string[];
  description: string;          // content under ## Description heading
  notes?: string;               // content under ## Notes heading
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  notes?: string;
  due_date?: string;
  priority?: TaskPriority;
  tags?: string[];
  status?: TaskStatus;          // defaults to 'todo'
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  notes?: string;
  due_date?: string | null;     // null clears the field
  priority?: TaskPriority;
  tags?: string[];
  sort_order?: number;
  telegram_message_id?: number;
}

export interface TaskFilters {
  status?: string;              // single status or comma-separated list
  tags?: string;                // comma-separated, OR logic
  priority?: TaskPriority;
  overdue?: boolean;            // due_date < today && status !== done
  due_today?: boolean;          // due_date === today
  due_tomorrow?: boolean;       // due_date === today + 1
  search?: string;              // searches title and tags
  sort?: string;                // see API sort options
}
