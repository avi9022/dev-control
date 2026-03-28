// ─── Fixed Phase IDs ───
// The two immutable endpoints that bookend every AI pipeline.
export const FIXED_PHASES = {
  BACKLOG: 'BACKLOG',
  DONE: 'DONE',
} as const

// ─── Pipeline Phase Types ───
export enum PhaseType {
  Agent = 'agent',
  Manual = 'manual',
  Fixed = 'fixed',
}

// ─── Phase History Exit Events ───
export enum PhaseExitEvent {
  Completed = 'completed',
  Stopped = 'stopped',
  Crashed = 'crashed',
  Stalled = 'stalled',
  Error = 'error',
}

// ─── Task Attention Reasons ───
export enum AttentionReason {
  Crashed = 'crashed',
  Stalled = 'stalled',
  MaxRetries = 'max_retries',
  Error = 'error',
}

// ─── Git Strategies ───
export const GIT_STRATEGY = {
  WORKTREE: 'worktree',
  NONE: 'none',
} as const

// ─── Comment Resolver Types ───
export const RESOLVER = {
  HUMAN: 'human',
  AGENT: 'agent',
} as const

// ─── Directory / Service States ───
export enum DirectoryStatus {
  Running = 'RUNNING',
  Stopped = 'STOPPED',
  Unknown = 'UNKNOWN',
  Initializing = 'INITIALIZING',
}

// ─── Workflow Statuses ───
export enum WorkflowStatus {
  Idle = 'idle',
  Starting = 'starting',
  Running = 'running',
  Stopping = 'stopping',
  Partial = 'partial',
  Error = 'error',
}

// ─── Workflow Step Statuses ───
export enum WorkflowStepStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Skipped = 'skipped',
}

// ─── Workflow Execution Record Statuses ───
export enum WorkflowRecordStatus {
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

// ─── Default Colors ───
export const DEFAULT_PHASE_COLOR = '#7C8894'
export const DEFAULT_BOARD_COLOR = '#9BB89E'

// ─── Short ID Display ───
export const SHORT_ID_LENGTH = 8

// ─── Polling Intervals ───
export const PORT_POLL_INTERVAL_MS = 500
export const QUEUE_LIST_POLL_INTERVAL_MS = 500
export const QUEUE_DATA_POLL_INTERVAL_MS = 5000
export const LOG_LINE_COUNT_CACHE_TTL_MS = 5000
export const DOCKER_DEFAULT_REFRESH_INTERVAL_MS = 3000

// ─── AI Automation Timeouts & Retries ───
export const DEFAULT_STALL_TIMEOUT_MINUTES = 3
export const MAX_STALL_RETRIES = 3

// ─── Worktree Prefix ───
export const WORKTREE_ID_PREFIX = 'wt-'

// ─── Workflow Step Defaults ───
export const DEFAULT_STEP_TIMEOUT_MS = 120_000
export const WORKFLOW_RETRY_DELAY_MS = 1_000

// ─── DynamoDB Defaults ───
export const DYNAMODB_DEFAULT_SCAN_LIMIT = 50
export const DYNAMODB_PAGE_SIZE = 100

// ─── Broker Archive ───
export const MESSAGE_ARCHIVE_LIMIT = 5
