export class BoundaryViolationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoundaryViolationException';
  }
}
