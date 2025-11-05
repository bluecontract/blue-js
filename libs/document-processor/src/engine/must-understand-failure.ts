export class MustUnderstandFailure extends Error {
  constructor(message?: string) {
    super(message ?? 'MustUnderstand failure');
    this.name = 'MustUnderstandFailure';
  }
}
