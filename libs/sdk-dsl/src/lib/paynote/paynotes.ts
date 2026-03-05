import { PayNoteBuilder } from './paynote-builder.js';

export class PayNotes {
  static payNote(name: string): PayNoteBuilder {
    return PayNoteBuilder.create(name);
  }
}
