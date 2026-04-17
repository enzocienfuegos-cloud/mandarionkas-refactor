export type WorkspaceProjectStatus = 'Draft' | 'In progress' | 'Review';

export type WorkspaceProjectFormat = 'Rich Media' | 'HTML5' | 'Takeover';

export type WorkspaceProjectColumn =
  | 'project'
  | 'format'
  | 'size'
  | 'status'
  | 'lastUpdated'
  | 'owner'
  | 'progress'
  | 'priority'
  | 'dueDate'
  | 'channel'
  | 'version'
  | 'campaign'
  | 'folder'
  | 'tags';

export type WorkspaceProjectRow = {
  id: string;
  name: string;
  folder: string;
  format: WorkspaceProjectFormat;
  size: string;
  status: WorkspaceProjectStatus;
  lastUpdated: string;
  updatedAt: string;
  owner: string;
  ownerInitials: string;
  progress: number;
  priority: 'Low' | 'Medium' | 'High';
  dueDate?: string;
  channel: string;
  version: string;
  campaign: string;
  tags: string[];
  thumbnailTone: 'pink' | 'violet' | 'blue' | 'amber' | 'green';
  archivedAt?: string;
};

export type SummaryCardData = {
  id: string;
  label: string;
  value: string;
  helper: string;
  tone: 'pink' | 'violet' | 'green' | 'amber';
};

export type RecentExportItem = {
  id: string;
  projectName: string;
  exportType: string;
  timeAgo: string;
  tone: WorkspaceProjectRow['thumbnailTone'];
  ok: boolean;
};

export type BuildTimeSnapshot = {
  averageDays: string;
  deltaLabel: string;
  slowProjects: number;
  byFormat: Array<{ format: WorkspaceProjectFormat; days: string; progress: number; tone: 'pink' | 'violet' | 'blue' }>;
};

export type WorkspaceFilters = {
  format: 'all' | WorkspaceProjectFormat;
  folder: string;
  status: 'all' | WorkspaceProjectStatus;
  owner: string;
  lastUpdated: 'all' | '24h' | '7d' | '30d';
  size: string;
};

export type DisplayMode = 'list' | 'grid';
