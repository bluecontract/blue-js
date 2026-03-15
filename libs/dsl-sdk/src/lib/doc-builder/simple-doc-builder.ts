import type { BlueNode } from '@blue-labs/language';
import type { JsonObject } from '../core/types.js';
import { DocBuilder } from './doc-builder.js';

export class SimpleDocBuilder extends DocBuilder {
  private constructor(initial?: JsonObject) {
    super(initial);
  }

  static override doc(): SimpleDocBuilder {
    return new SimpleDocBuilder();
  }

  static override edit(
    existingDocument: JsonObject | BlueNode,
  ): SimpleDocBuilder {
    return new SimpleDocBuilder(this.documentToJson(existingDocument));
  }

  static override from(
    existingDocument: JsonObject | BlueNode,
  ): SimpleDocBuilder {
    return new SimpleDocBuilder(this.documentToJson(existingDocument));
  }
}
