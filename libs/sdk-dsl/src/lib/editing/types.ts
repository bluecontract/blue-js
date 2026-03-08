import type { BlueNode } from '@blue-labs/language';

export type EditingJsonPrimitive = string | number | boolean | null;

export type EditingJsonValue =
  | EditingJsonPrimitive
  | EditingJsonValue[]
  | EditingJsonObject;

export type EditingJsonObject = {
  [key: string]: EditingJsonValue;
};

export type DocStructureFieldKind =
  | 'primitive'
  | 'object'
  | 'array'
  | 'typed-node-like';

export type ContractKind =
  | 'channel'
  | 'operation'
  | 'operationImpl'
  | 'workflow'
  | 'section'
  | 'policy'
  | 'other';

export interface FieldEntry {
  path: string;
  kind: DocStructureFieldKind;
  preview: string;
  type?: string;
  rawValue?: EditingJsonValue;
}

export interface ContractEntry {
  key: string;
  type?: string;
  kind: ContractKind;
  summary: string;
  channel?: string;
  operation?: string;
  requestType?: string;
  requestDescription?: string;
  eventType?: string;
  subscriptionId?: string;
  paths?: string[];
  relatedFields?: string[];
  relatedContracts?: string[];
  compositeChildren?: string[];
  raw: EditingJsonValue;
}

export interface SectionEntry {
  key: string;
  title?: string;
  summary?: string;
  relatedFields: string[];
  relatedContracts: string[];
  raw: EditingJsonValue;
}

export interface DocStructureSummary {
  name?: string;
  description?: string;
  type?: string;
  fields: FieldEntry[];
  contracts: ContractEntry[];
  sections: SectionEntry[];
  policies: ContractEntry[];
  unknownContracts: ContractEntry[];
}

export interface DocPatchOperation {
  op: 'add' | 'replace' | 'remove';
  path: string;
  value?: EditingJsonValue;
}

export type BlueChangeBucket =
  | 'participants'
  | 'logic'
  | 'ai'
  | 'payments'
  | 'paynote'
  | 'misc';

export interface BlueContractChange {
  action: 'add' | 'replace' | 'remove';
  key: string;
  type?: string;
  sectionKey?: string;
  bucket: BlueChangeBucket;
  contract?: EditingJsonValue;
}

export interface BlueChangeGroup {
  key: string;
  title: string;
  sectionKey?: string;
  bucket?: BlueChangeBucket;
  changes: BlueContractChange[];
}

export interface BlueChangePlanSummary {
  rootChanges: DocPatchOperation[];
  contractAdds: BlueContractChange[];
  contractReplacements: BlueContractChange[];
  contractRemovals: BlueContractChange[];
  groups: BlueChangeGroup[];
  notes: string[];
}

export type DocStructureInput = BlueNode | DocStructureSummary;
