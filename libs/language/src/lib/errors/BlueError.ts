export interface BlueErrorDetail {
  code: string;
  message: string;
  locationPath?: string[];
  context?: Record<string, unknown>;
}

export class BlueError extends Error {
  public readonly code: string;
  public readonly category?: BlueLanguageErrorCategory;
  public readonly details: BlueErrorDetail[];

  constructor(
    code: string,
    message: string,
    details?: BlueErrorDetail[],
    category?: BlueLanguageErrorCategory,
  ) {
    super(message);
    this.code = code;
    this.category = category;
    this.details = details && details.length > 0 ? details : [];
    this.name = 'BlueError';
  }
}

export const BlueLanguageErrorCategory = {
  InvalidSyntax: 'InvalidSyntax',
  DuplicateKey: 'DuplicateKey',
  InvalidReservedField: 'InvalidReservedField',
  InvalidBlueId: 'InvalidBlueId',
  InvalidReferenceShape: 'InvalidReferenceShape',
  InvalidBlueIdInput: 'InvalidBlueIdInput',
  ProviderUnavailable: 'ProviderUnavailable',
  ProviderBlueIdMismatch: 'ProviderBlueIdMismatch',
  TypeCycle: 'TypeCycle',
  FixedValueConflict: 'FixedValueConflict',
  TypeCompatibilityViolation: 'TypeCompatibilityViolation',
  SchemaVocabularyError: 'SchemaVocabularyError',
  SchemaViolation: 'SchemaViolation',
  ListControlViolation: 'ListControlViolation',
  CanonicalizationError: 'CanonicalizationError',
  CircularSetError: 'CircularSetError',
  UnsupportedPreprocessingTransform: 'UnsupportedPreprocessingTransform',
} as const;

export type BlueLanguageErrorCategory =
  (typeof BlueLanguageErrorCategory)[keyof typeof BlueLanguageErrorCategory];

export function blueLanguageErrorCategory(
  error: unknown,
): BlueLanguageErrorCategory | undefined {
  return isCategorized(error) ? error.category : undefined;
}

function isCategorized(
  error: unknown,
): error is { readonly category: BlueLanguageErrorCategory } {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { readonly category?: unknown }).category === 'string'
  );
}

export const BlueErrorCode = {
  AMBIGUOUS_BLUE_ID_PAYLOAD: 'AMBIGUOUS_BLUE_ID_PAYLOAD',
  BLUE_ID_MISMATCH: 'BLUE_ID_MISMATCH',
  INVALID_STORAGE_SHAPE: 'INVALID_STORAGE_SHAPE',
  REPO_UNKNOWN_REPO_BLUE_ID: 'REPO_UNKNOWN_REPO_BLUE_ID',
  REPO_UNREPRESENTABLE_IN_TARGET_VERSION:
    'REPO_UNREPRESENTABLE_IN_TARGET_VERSION',
  INVALID_BLUE_CONTEXT_REPOSITORIES: 'INVALID_BLUE_CONTEXT_REPOSITORIES',
  INVALID_REPOSITORY_POINTER: 'INVALID_REPOSITORY_POINTER',
} as const;

export type BlueErrorCode = (typeof BlueErrorCode)[keyof typeof BlueErrorCode];
