import type { ProcessorError } from '../types/errors.js';
import type { ProcessorErrorCategory } from '../types/document-processing-result.js';

export class ProcessorFatalError extends Error {
  constructor(
    message: string,
    readonly processorError?: ProcessorError,
    readonly category?: ProcessorErrorCategory,
  ) {
    super(message || 'Processor fatal error');
    this.name = 'ProcessorFatalError';
  }
}
