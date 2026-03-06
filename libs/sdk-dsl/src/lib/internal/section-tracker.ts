import { BlueNode } from '@blue-labs/language';

import { getContract } from './contracts';
import { resolveTypeInput } from './type-input';
import { toBlueNode } from './value-to-node';

export class SectionTracker {
  readonly fields = new Set<string>();
  readonly contracts = new Set<string>();

  constructor(
    readonly key: string,
    readonly title: string,
    readonly summary: string | null,
  ) {}

  addField(path: string): void {
    this.fields.add(path);
  }

  addContract(contractKey: string): void {
    this.contracts.add(contractKey);
  }

  buildNode(): BlueNode {
    const section = new BlueNode().setType(
      resolveTypeInput('Conversation/Document Section'),
    );
    section.addProperty('title', toBlueNode(this.title));

    if (this.summary?.trim()) {
      section.addProperty('summary', toBlueNode(this.summary.trim()));
    }

    if (this.fields.size > 0) {
      section.addProperty(
        'relatedFields',
        new BlueNode().setItems(
          Array.from(this.fields, (field) => toBlueNode(field)),
        ),
      );
    }

    if (this.contracts.size > 0) {
      section.addProperty(
        'relatedContracts',
        new BlueNode().setItems(
          Array.from(this.contracts, (contractKey) => toBlueNode(contractKey)),
        ),
      );
    }

    return section;
  }
}

export function sectionTrackerFromDocument(
  document: BlueNode,
  sectionKey: string,
  fallbackTitle: string,
  fallbackSummary: string | null,
): SectionTracker | null {
  const section = getContract(document, sectionKey);
  if (!section) {
    return null;
  }

  let title = fallbackTitle;
  let summary = fallbackSummary;
  const properties = section.getProperties();

  const titleValue = properties?.title?.getValue();
  if (titleValue != null) {
    title = String(titleValue);
  }

  if (summary == null) {
    const summaryValue = properties?.summary?.getValue();
    if (summaryValue != null) {
      summary = String(summaryValue);
    }
  }

  const tracker = new SectionTracker(sectionKey, title, summary);
  readStringList(properties?.relatedFields ?? null, tracker.fields);
  readStringList(properties?.relatedContracts ?? null, tracker.contracts);
  return tracker;
}

function readStringList(node: BlueNode | null, sink: Set<string>): void {
  const items = node?.getItems();
  if (!items) {
    return;
  }

  for (const item of items) {
    const value = item?.getValue();
    if (value == null) {
      continue;
    }

    const text = String(value).trim();
    if (text.length > 0) {
      sink.add(text);
    }
  }
}
