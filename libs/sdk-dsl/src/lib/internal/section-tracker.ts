import { BlueNode } from '@blue-labs/language';

import { ensureContracts, TYPE_ALIASES } from './contracts.js';
import { normalizePointer } from './pointer.js';

function readStringList(node: BlueNode | undefined): string[] {
  return (
    node
      ?.getItems()
      ?.map((item: BlueNode) => item.getValue())
      .filter((value: unknown): value is string => typeof value === 'string') ??
    []
  );
}

export class SectionTracker {
  readonly fields = new Set<string>();
  readonly contracts = new Set<string>();

  constructor(
    readonly key: string,
    readonly title: string,
    readonly summary?: string,
  ) {}

  static open(
    document: BlueNode,
    key: string,
    title?: string,
    summary?: string,
  ): SectionTracker {
    const existing = ensureContracts(document)[key];
    if (!existing) {
      return new SectionTracker(key, title ?? key, summary);
    }

    const existingTitle = existing.getProperties()?.title?.getValue();
    const existingSummary = existing.getProperties()?.summary?.getValue();
    const tracker = new SectionTracker(
      key,
      typeof existingTitle === 'string' ? existingTitle : title ?? key,
      summary ??
        (typeof existingSummary === 'string' ? existingSummary : undefined),
    );

    for (const field of readStringList(existing.getProperties()?.relatedFields)) {
      tracker.fields.add(field);
    }
    for (const contract of readStringList(
      existing.getProperties()?.relatedContracts,
    )) {
      tracker.contracts.add(contract);
    }
    return tracker;
  }

  trackField(pointer: string): void {
    this.fields.add(normalizePointer(pointer, 'field path'));
  }

  trackContract(key: string): void {
    const normalized = key.trim();
    if (normalized.length > 0) {
      this.contracts.add(normalized);
    }
  }

  buildNode(): BlueNode {
    const section = new BlueNode().setType(TYPE_ALIASES.documentSection);
    section.addProperty('title', new BlueNode().setValue(this.title));
    if (this.summary) {
      section.addProperty('summary', new BlueNode().setValue(this.summary));
    }
    if (this.fields.size > 0) {
      section.addProperty(
        'relatedFields',
        new BlueNode().setItems(
          [...this.fields].map((field) => new BlueNode().setValue(field)),
        ),
      );
    }
    if (this.contracts.size > 0) {
      section.addProperty(
        'relatedContracts',
        new BlueNode().setItems(
          [...this.contracts].map((contract) => new BlueNode().setValue(contract)),
        ),
      );
    }
    return section;
  }
}
