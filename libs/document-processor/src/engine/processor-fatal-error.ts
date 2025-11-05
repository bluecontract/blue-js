import type { ProcessorError } from '../types/errors.js';

export class ProcessorFatalError extends Error {
  constructor(
    message: string,
    readonly processorError?: ProcessorError,
  ) {
    super(message || 'Processor fatal error');
    this.name = 'ProcessorFatalError';
  }
}
