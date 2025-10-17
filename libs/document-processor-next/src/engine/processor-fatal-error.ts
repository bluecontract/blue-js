export class ProcessorFatalError extends Error {
  constructor(message: string) {
    super(message || 'Processor fatal error');
    this.name = 'ProcessorFatalError';
  }
}
