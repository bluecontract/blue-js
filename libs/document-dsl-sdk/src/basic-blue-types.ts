export const BasicBlueTypes = {
  Text: 'Text',
  Integer: 'Integer',
  Double: 'Double',
  Boolean: 'Boolean',
  List: 'List',
  Dictionary: 'Dictionary',
} as const;

export type BasicBlueType =
  (typeof BasicBlueTypes)[keyof typeof BasicBlueTypes];

export const BasicBlueTypeValues: readonly BasicBlueType[] =
  Object.values(BasicBlueTypes);
