export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface SectionSnapshot {
  readonly key: string;
  readonly title: string;
  readonly summary?: string;
  readonly relatedFields: readonly string[];
  readonly relatedContracts: readonly string[];
}

export interface SectionContext {
  readonly key: string;
  readonly title: string;
  readonly summary?: string;
  readonly relatedFields: Set<string>;
  readonly relatedContracts: Set<string>;
}

export interface PointerWriteOptions {
  readonly createMissing?: boolean;
}
