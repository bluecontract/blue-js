import { BlueNode } from '@blue-labs/language';

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function encodePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function normalizePointer(pointer: string, label = 'pointer'): string {
  const trimmed = pointer.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }
  if (trimmed === '/') {
    return '/';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function normalizeRequiredPointer(
  pointer: string,
  label = 'pointer',
): string {
  const normalized = normalizePointer(pointer, label);
  if (normalized === '/') {
    throw new Error(`${label} cannot target the document root.`);
  }
  return normalized;
}

export function splitPointer(pointer: string): string[] {
  if (pointer === '/') {
    return [];
  }
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => decodePointerSegment(segment));
}

function isArrayIndex(segment: string): boolean {
  return /^[0-9]+$/.test(segment);
}

function toArrayIndex(segment: string, pointer: string): number {
  if (!isArrayIndex(segment)) {
    throw new Error(`Expected an array index in pointer '${pointer}'.`);
  }
  return Number.parseInt(segment, 10);
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

function createContainer(nextSegment: string): BlueNode {
  return isArrayIndex(nextSegment)
    ? new BlueNode().setItems([])
    : new BlueNode().setProperties({});
}

function ensureChildContainer(
  parent: BlueNode,
  segment: string,
  nextSegment: string,
  pointer: string,
): BlueNode {
  const items = parent.getItems();
  if (items) {
    const index = toArrayIndex(segment, pointer);
    while (items.length <= index) {
      items.push(new BlueNode());
    }
    const existing = items[index];
    if (
      existing &&
      (existing.getProperties() !== undefined || existing.getItems() !== undefined)
    ) {
      return existing;
    }
    const created = createContainer(nextSegment);
    items[index] = created;
    return created;
  }

  const properties = ensureProperties(parent);
  const existing = properties[segment];
  if (
    existing &&
    (existing.getProperties() !== undefined || existing.getItems() !== undefined)
  ) {
    return existing;
  }
  const created = createContainer(nextSegment);
  properties[segment] = created;
  return created;
}

export function getNodeAtPointer(
  root: BlueNode,
  pointer: string,
): BlueNode | undefined {
  const normalized = normalizePointer(pointer);
  if (normalized === '/') {
    return root;
  }

  let current: BlueNode | undefined = root;
  for (const segment of splitPointer(normalized)) {
    if (!current) {
      return undefined;
    }
    const items = current.getItems();
    if (items) {
      if (!isArrayIndex(segment)) {
        return undefined;
      }
      current = items[Number.parseInt(segment, 10)];
      continue;
    }
    current = current.getProperties()?.[segment];
  }

  return current;
}

export function setNodeAtPointer(
  root: BlueNode,
  pointer: string,
  value: BlueNode,
): void {
  const normalized = normalizeRequiredPointer(pointer);
  const segments = splitPointer(normalized);

  let current = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    current = ensureChildContainer(
      current,
      segments[index],
      segments[index + 1],
      normalized,
    );
  }

  const leaf = segments.at(-1);
  if (!leaf) {
    throw new Error(`Invalid pointer '${pointer}'.`);
  }

  const items = current.getItems();
  if (items) {
    const arrayIndex = toArrayIndex(leaf, normalized);
    while (items.length <= arrayIndex) {
      items.push(new BlueNode());
    }
    items[arrayIndex] = value;
    return;
  }

  ensureProperties(current)[leaf] = value;
}

export function removeNodeAtPointer(root: BlueNode, pointer: string): void {
  const normalized = normalizeRequiredPointer(pointer);
  const segments = splitPointer(normalized);

  let current: BlueNode | undefined = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (!current) {
      return;
    }
    const segment = segments[index];
    const items = current.getItems();
    if (items) {
      if (!isArrayIndex(segment)) {
        return;
      }
      current = items[Number.parseInt(segment, 10)];
      continue;
    }
    current = current.getProperties()?.[segment];
  }

  if (!current) {
    return;
  }

  const leaf = segments.at(-1);
  if (!leaf) {
    return;
  }

  const items = current.getItems();
  if (items) {
    if (!isArrayIndex(leaf)) {
      return;
    }
    const arrayIndex = Number.parseInt(leaf, 10);
    if (arrayIndex >= 0 && arrayIndex < items.length) {
      items.splice(arrayIndex, 1);
    }
    return;
  }

  const properties = current.getProperties();
  if (properties) {
    delete properties[leaf];
  }
}

export function pointerFromPath(path: string[]): string {
  if (path.length === 0) {
    return '/';
  }
  return `/${path.map((segment) => encodePointerSegment(segment)).join('/')}`;
}
