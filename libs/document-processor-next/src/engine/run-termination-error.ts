export class RunTerminationError extends Error {
  constructor(public readonly fatal: boolean) {
    super(
      fatal
        ? 'Processing terminated due to fatal error'
        : 'Processing terminated',
    );
    this.name = 'RunTerminationError';
  }
}
