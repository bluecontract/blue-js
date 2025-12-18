export interface BlueErrorDetail {
  code: string;
  severity: 'info' | 'warning' | 'error' | 'fatal';
  message: string;
  locationPath?: string[];
  context?: Record<string, unknown>;
}

export class BlueError extends Error {
  public readonly code: string;
  public readonly details: BlueErrorDetail[];

  constructor(code: string, message: string, details?: BlueErrorDetail[]) {
    super(message);
    this.code = code;
    this.details = details && details.length > 0 ? details : [];
    this.name = 'BlueError';
  }
}

export const BlueErrorCode = {
  REPO_UNKNOWN_REPO_BLUE_ID: 'REPO_UNKNOWN_REPO_BLUE_ID',
  REPO_UNREPRESENTABLE_IN_TARGET_VERSION:
    'REPO_UNREPRESENTABLE_IN_TARGET_VERSION',
  INVALID_BLUE_CONTEXT_REPOSITORIES: 'INVALID_BLUE_CONTEXT_REPOSITORIES',
  INVALID_REPOSITORY_POINTER: 'INVALID_REPOSITORY_POINTER',
} as const;

export type BlueErrorCode = (typeof BlueErrorCode)[keyof typeof BlueErrorCode];
