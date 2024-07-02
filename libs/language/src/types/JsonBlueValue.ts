import Big from 'big.js';

/**
 * A JSON-like value that can be represented in Blue.
 * Created based on import('type-fest').JsonValue type.
 * The difference is that it includes Big.js values.
 */
export type JsonBlueObject = { [Key in string]: JsonBlueValue } & {
  [Key in string]?: JsonBlueValue | undefined;
};

export type JsonBlueArray = JsonBlueValue[] | readonly JsonBlueValue[];

export type JsonBluePrimitive = string | number | boolean | null;

export type JsonBlueValue =
  | JsonBluePrimitive
  | JsonBlueObject
  | JsonBlueArray
  | Big;
