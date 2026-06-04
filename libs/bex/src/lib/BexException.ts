export type BexErrorClass =
  | 'parse-error'
  | 'compile-error'
  | 'runtime-error'
  | 'output-conversion-error'
  | 'gas-exhaustion';

export interface BexDiagnosticFields {
  readonly sourcePath?: string;
  readonly operator?: string;
  readonly functionName?: string;
  readonly pointer?: string;
  readonly cause?: unknown;
}

export class BexException extends Error {
  public readonly sourcePath?: string;
  public readonly operator?: string;
  public readonly functionName?: string;
  public readonly pointer?: string;
  public override readonly cause?: unknown;

  constructor(
    message: string,
    public readonly errorClass: BexErrorClass = 'runtime-error',
    diagnostics: BexDiagnosticFields = {},
  ) {
    super(message, { cause: diagnostics.cause });
    this.name = 'BexException';
    this.sourcePath = diagnostics.sourcePath;
    this.operator = diagnostics.operator;
    this.functionName = diagnostics.functionName;
    this.pointer = diagnostics.pointer;
    this.cause = diagnostics.cause;
  }
}
