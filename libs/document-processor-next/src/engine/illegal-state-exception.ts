import { ProcessorFatalError } from './processor-fatal-error.js';
import { ProcessorErrors } from '../types/errors.js';

export class IllegalStateException extends ProcessorFatalError {
  constructor(message: string) {
    super(message, ProcessorErrors.illegalState(message));
    this.name = 'IllegalStateException';
  }
}
