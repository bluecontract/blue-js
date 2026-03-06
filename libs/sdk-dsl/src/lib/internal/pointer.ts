import { BlueNode } from '@blue-labs/language';

export function normalizeRequiredPointer(
  pointer: string,
  argumentName: string,
): string {
  if (pointer == null || pointer.length === 0 || pointer[0] !== '/') {
    throw new Error(
      `${argumentName} must be a JSON pointer starting with '/': ${String(
        pointer,
      )}`,
    );
  }
  validatePointerEscapes(pointer);
  return pointer;
}

export function splitPointerSegments(pointer: string): string[] {
  const normalized = normalizeRequiredPointer(pointer, 'pointer');
  if (normalized === '/') {
    return [];
  }

  return normalized
    .slice(1)
    .split('/')
    .map((segment) => unescapePointerSegment(segment));
}

export function isArrayIndexSegment(segment: string): boolean {
  if (segment.length === 0) {
    return false;
  }
  if (!/^\d+$/.test(segment)) {
    return false;
  }
  return segment === '0' || segment[0] !== '0';
}

export function parseArrayIndex(segment: string): number {
  if (!isArrayIndexSegment(segment)) {
    return -1;
  }

  const parsed = Number.parseInt(segment, 10);
  return Number.isSafeInteger(parsed) ? parsed : -1;
}

export function getPointerNode(
  root: BlueNode,
  pointer: string,
): BlueNode | null {
  const normalized = normalizeRequiredPointer(pointer, 'pointer');
  if (normalized === '/') {
    return root;
  }

  let current: BlueNode | null = root;
  for (const segment of splitPointerSegments(normalized)) {
    if (!current) {
      return null;
    }

    const items = current.getItems();
    if (items) {
      const index = parseArrayIndex(segment);
      if (index < 0 || index >= items.length) {
        return null;
      }
      current = items[index] ?? null;
      continue;
    }

    const properties = current.getProperties();
    if (!properties) {
      return null;
    }
    current = properties[segment] ?? null;
  }

  return current;
}

export function writePointer(
  root: BlueNode,
  pointer: string,
  valueNode: BlueNode,
): void {
  const normalized = normalizeRequiredPointer(pointer, 'pointer');
  if (normalized === '/') {
    throw new Error('pointer cannot target root');
  }

  const segments = splitPointerSegments(normalized);
  let current = root;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index] as string;
    const nextSegment = segments[index + 1] as string;
    current = descendOrCreate(current, segment, nextSegment, normalized);
  }

  const leaf = segments[segments.length - 1] as string;
  assign(current, leaf, valueNode, normalized);
}

export function removePointer(root: BlueNode, pointer: string): void {
  const normalized = normalizeRequiredPointer(pointer, 'pointer');
  if (normalized === '/') {
    throw new Error('pointer cannot target root');
  }

  const segments = splitPointerSegments(normalized);
  let current: BlueNode | null = root;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index] as string;
    current = descendExisting(current, segment, normalized);
    if (!current) {
      return;
    }
  }

  const leaf = segments[segments.length - 1] as string;
  const items = current?.getItems();
  if (items) {
    const index = parseArrayIndex(leaf);
    if (index >= 0 && index < items.length) {
      items.splice(index, 1);
    }
    return;
  }

  current?.removeProperty(leaf);
}

function validatePointerEscapes(pointer: string): void {
  for (let index = 0; index < pointer.length; index += 1) {
    if (pointer[index] !== '~') {
      continue;
    }
    const next = pointer[index + 1];
    if (next !== '0' && next !== '1') {
      throw new Error(`Invalid JSON pointer escape in pointer: ${pointer}`);
    }
    index += 1;
  }
}

function unescapePointerSegment(segment: string): string {
  let decoded = '';
  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    if (char !== '~') {
      decoded += char;
      continue;
    }

    const next = segment[index + 1];
    if (next === '0') {
      decoded += '~';
    } else if (next === '1') {
      decoded += '/';
    } else {
      throw new Error(`Invalid JSON pointer escape in segment: ${segment}`);
    }
    index += 1;
  }
  return decoded;
}

function descendOrCreate(
  current: BlueNode,
  segment: string,
  nextSegment: string,
  fullPath: string,
): BlueNode {
  const items = current.getItems();
  if (items) {
    const index = parseArrayIndex(segment);
    if (index < 0) {
      throw new Error(`Expected numeric array segment in path: ${fullPath}`);
    }

    while (items.length <= index) {
      items.push(new BlueNode());
    }

    let child = items[index];
    if (!child) {
      child = new BlueNode();
      items[index] = child;
    }
    ensureContainerForNextSegment(child, nextSegment);
    return child;
  }

  const properties = ensureProperties(current);
  let child = properties[segment];
  if (!child) {
    child = new BlueNode();
    properties[segment] = child;
  }
  ensureContainerForNextSegment(child, nextSegment);
  return child;
}

function descendExisting(
  current: BlueNode | null,
  segment: string,
  fullPath: string,
): BlueNode | null {
  if (!current) {
    return null;
  }

  const items = current.getItems();
  if (items) {
    const index = parseArrayIndex(segment);
    if (index < 0) {
      throw new Error(`Expected numeric array segment in path: ${fullPath}`);
    }
    return items[index] ?? null;
  }

  return current.getProperties()?.[segment] ?? null;
}

function assign(
  current: BlueNode,
  leaf: string,
  valueNode: BlueNode,
  fullPath: string,
): void {
  const items = current.getItems();
  if (items) {
    const index = parseArrayIndex(leaf);
    if (index < 0) {
      throw new Error(`Expected numeric array segment in path: ${fullPath}`);
    }

    while (items.length <= index) {
      items.push(new BlueNode());
    }
    items[index] = valueNode;
    return;
  }

  ensureProperties(current)[leaf] = valueNode;
}

function ensureContainerForNextSegment(
  node: BlueNode,
  nextSegment: string,
): void {
  if (node.getProperties() || node.getItems()) {
    return;
  }

  if (isArrayIndexSegment(nextSegment)) {
    node.setItems([]);
    return;
  }

  node.setProperties({});
}

function ensureProperties(node: BlueNode): Record<string, BlueNode> {
  const existing = node.getProperties();
  if (existing) {
    return existing;
  }

  const created: Record<string, BlueNode> = {};
  node.setProperties(created);
  return created;
}
