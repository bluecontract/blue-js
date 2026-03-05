import { BlueNode, applyBlueNodePatch } from '@blue-labs/language';
import { DocBuilder } from '../doc-builder/doc-builder.js';
import { fromJsonDocument, toOfficialJson } from '../core/serialization.js';
import { removePointer, setPointer } from '../core/pointers.js';
import type { JsonObject, JsonValue } from '../core/types.js';
import { diffJsonDocuments, type JsonPatchOperation } from './diff.js';

type ExistingDocument = BlueNode | JsonObject;

function toJsonDocument(document: ExistingDocument): JsonObject {
  if (document instanceof BlueNode) {
    return toOfficialJson(document);
  }
  return structuredClone(document);
}

function assertPatchPaths(operations: readonly JsonPatchOperation[]): void {
  for (const operation of operations) {
    if (!operation.path.startsWith('/')) {
      throw new Error(
        `Invalid patch path '${operation.path}'. Root replacement is unsupported.`,
      );
    }
  }
}

export class DocPatch {
  private readonly originalJson: JsonObject;
  private nextJson: JsonObject;

  private constructor(originalJson: JsonObject) {
    this.originalJson = structuredClone(originalJson);
    this.nextJson = structuredClone(originalJson);
  }

  static from(document: ExistingDocument): DocPatch {
    return new DocPatch(toJsonDocument(document));
  }

  mutate(customizer: (builder: DocBuilder) => void): this {
    const builder = DocBuilder.from(this.nextJson);
    customizer(builder);
    this.nextJson = builder.buildJson();
    return this;
  }

  field(path: string, value: JsonValue): this {
    setPointer(this.nextJson, path, value);
    return this;
  }

  remove(path: string): this {
    removePointer(this.nextJson, path);
    return this;
  }

  contract(key: string, contract: JsonObject): this {
    setPointer(this.nextJson, `/contracts/${key}`, structuredClone(contract));
    return this;
  }

  removeContract(key: string): this {
    removePointer(this.nextJson, `/contracts/${key}`);
    return this;
  }

  build(): JsonPatchOperation[] {
    const operations = diffJsonDocuments(this.originalJson, this.nextJson);
    assertPatchPaths(operations);
    return operations;
  }

  applyTo(document: BlueNode, mutateOriginal = false): BlueNode {
    const operations = this.build();
    let base = mutateOriginal ? document : document.clone();
    for (const operation of operations) {
      base = applyBlueNodePatch(
        base,
        operation as Parameters<typeof applyBlueNodePatch>[1],
        true,
      );
    }
    return base;
  }

  nextDocumentJson(): JsonObject {
    return structuredClone(this.nextJson);
  }

  nextDocumentNode(): BlueNode {
    return fromJsonDocument(this.nextDocumentJson());
  }
}
