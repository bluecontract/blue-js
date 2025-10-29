const MAX_SNIPPET_LENGTH = 120;

function truncate(code: string): string {
  if (code.length <= MAX_SNIPPET_LENGTH) {
    return code;
  }
  return `${code.slice(0, MAX_SNIPPET_LENGTH - 3)}...`;
}

export class CodeBlockEvaluationError extends Error {
  constructor(
    readonly code: string,
    override readonly cause?: unknown,
  ) {
    super(`Failed to evaluate code block: ${truncate(code)}`, { cause });
    this.name = 'CodeBlockEvaluationError';
  }
}
