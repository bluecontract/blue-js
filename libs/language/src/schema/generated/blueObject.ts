import { SetRequired } from 'type-fest';

/* eslint-disable @typescript-eslint/no-empty-interface */
export interface BlueObject {
  blueId?: string;
  name?: string;
  description?: string;
  type?: BlueObject;
  value?: string | number | boolean | null;
  items?: BlueObject[];
  [k: string]: unknown;
}

// without index signature
export interface BaseBlueObject {
  blueId?: string;
  name?: string;
  description?: string;
  type?: BlueObject;
}

export interface BlueObjectStringValue extends BaseBlueObject {
  value?: string;
}

export interface BlueObjectBooleanValue extends BaseBlueObject {
  value?: boolean;
}

export interface BlueObjectStringListItems extends BaseBlueObject {
  items?: string[];
}

/**
 * @ts-to-zod-ignore
 */
export type BlueObjectWithId = SetRequired<BlueObject, 'blueId'>;
