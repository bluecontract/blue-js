import { DocumentNode } from '../types';
import { BlueNode } from '../../model';

export function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isDocumentNode(value: unknown): value is DocumentNode {
  return value instanceof BlueNode;
}
