import type { ProcessorErrorCategory } from '../types/document-processing-result.js';

export class BoundaryViolationException extends Error {
  constructor(
    message: string,
    readonly category?: ProcessorErrorCategory,
  ) {
    super(message);
    this.name = 'BoundaryViolationException';
  }
}
