export interface Department {
  _id: string;
  name: string;
  description?: string;
  color: string;
  heads: User[];
  members: User[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member' | 'viewer';
  avatar?: string;
  isActive?: boolean;
  lateThreshold?: string;
  createdAt?: string;
}

export interface ProjectMember {
  user: User;
  role: 'lead' | 'member' | 'viewer';
}

export interface ProjectLink {
  title: string;
  url: string;
}

export interface Project {
  _id: string;
  title: string;
  description: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  startDate: string;
  endDate: string;
  owner: User;
  members: ProjectMember[];
  tags: string[];
  progress: number;
  thumbnail?: string;
  links?: ProjectLink[];
  taskCounts?: Record<string, number>;
  totalTasks?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  name: string;
  url: string;
  type: 'file' | 'image' | 'link';
  uploadedAt: string;
}

export interface ITimerEvent {
  action: 'start' | 'pause' | 'resume' | 'hold' | 'finish';
  timestamp: string;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  remark?: string;
  project?: string | Project;
  isPersonal: boolean;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignees: User[];
  reporter: User;
  dueDate?: string;
  dueTime?: string;
  estimatedHours?: number;
  tags: string[];
  dependencies: Task[];
  attachments: Attachment[];
  links: string[];
  thumbnail?: string;
  notes?: string;
  order: number;
  comments?: Comment[];
  timerStatus: 'idle' | 'running' | 'paused' | 'on_hold' | 'finished';
  timerEvents: ITimerEvent[];
  totalElapsedSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  content: string;
  author: User;
  task?: string;
  project?: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceNote {
  content: string;
  documents: string[];
  links: string[];
  createdAt: string;
}

export interface Attendance {
  _id: string;
  user: string | User;
  date: string;
  checkIn?: string;
  checkOut?: string;
  lunchStart?: string;
  lunchStop?: string;
  lunchDuration: number;
  status: 'present' | 'absent' | 'half_day' | 'remote' | 'leave' | 'late';
  workMode: 'office' | 'remote' | 'hybrid';
  notes: AttendanceNote[];
  hoursWorked: number;
  isLate: boolean;
  approvedBy?: string;
  createdAt: string;
}

export interface AttendanceStats {
  totalDays: number;
  present: number;
  absent: number;
  halfDay: number;
  remote: number;
  leave: number;
  late: number;
  totalHours: number;
  avgHours: number;
}

export interface Notification {
  _id: string;
  recipient: string;
  sender: User;
  type: 'task_assigned' | 'comment_mention' | 'deadline_reminder' | 'status_change' | 'project_invite';
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface TeamMember extends User {
  activeTasks: number;
}

export interface BurndownData {
  totalTasks: number;
  data: Array<{ date: string; remaining: number; ideal: number }>;
}

export interface VelocityData {
  week: string;
  startDate: string;
  endDate: string;
  completed: number;
}

export interface AttendanceSummary {
  summary: Record<string, { count: number; avgHours: number }>;
  daily: Array<{ date: string; present: number; absent: number; leave: number }>;
}

export interface Resource {
  _id: string;
  name: string;
  description?: string;
  category: string;
  assignedTo: User;
  assignedBy: User;
  serialNumber?: string;
  condition: 'new' | 'good' | 'fair' | 'damaged';
  assignedAt: string;
  returnedAt?: string;
  isActive: boolean;
}

export interface Note {
  _id: string;
  title: string;
  content: string;
  owner: string;
  color: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  type: 'meeting' | 'reminder' | 'event' | 'deadline';
  date: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  color: string;
  links: string[];
  owner: User;
  createdBy: User;
  invitees: User[];
  location?: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  createdAt: string;
  updatedAt: string;
}
