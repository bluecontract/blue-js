import { readFileSync } from 'node:fs';

import {
  createCoordinationBlue,
  createCoordinationProcessor,
} from '@blue-labs/coordination';
import type { DocumentProcessingResult } from '@blue-labs/document-processor';
import { Blue, BlueNode } from '@blue-labs/language';

export interface ScenarioRuntime {
  readonly blue: Blue;
  readonly processor: ReturnType<typeof createCoordinationProcessor>;
}

export interface ScenarioSession {
  readonly sessionId: string;
  readonly label: string;
  current: DocumentProcessingResult;
  nextTimestamp: number;
}

export function createScenarioRuntime(): ScenarioRuntime {
  const blue = createCoordinationBlue();
  return {
    blue,
    processor: createCoordinationProcessor({ blue }),
  };
}

export function yamlResource(
  runtime: ScenarioRuntime,
  resourcePath: string,
): BlueNode {
  const source = readFileSync(
    new URL(
      `./resources/${normalizeResourcePath(resourcePath)}`,
      import.meta.url,
    ),
    'utf8',
  );
  return runtime.blue.yamlToNode(source);
}

export async function startDocument(
  runtime: ScenarioRuntime,
  sessionId: string,
  label: string,
  document: BlueNode,
): Promise<ScenarioSession> {
  const current = requireSuccess(
    `${label} initialize`,
    await runtime.processor.initializeDocument(document),
  );
  return { sessionId, label, current, nextTimestamp: 1 };
}

export async function startResource(
  runtime: ScenarioRuntime,
  sessionId: string,
  label: string,
  resourcePath: string,
): Promise<ScenarioSession> {
  return startDocument(
    runtime,
    sessionId,
    label,
    yamlResource(runtime, resourcePath),
  );
}

export async function processEvent(
  runtime: ScenarioRuntime,
  session: ScenarioSession,
  event: BlueNode,
  label: string,
): Promise<DocumentProcessingResult> {
  const result = requireSuccess(
    `${session.label} ${label}`,
    await runtime.processor.processDocument(session.current.document, event),
  );
  session.current = result;
  return result;
}

export async function operation(
  runtime: ScenarioRuntime,
  session: ScenarioSession,
  timelineId: string,
  operationName: string,
  request: BlueNode = new BlueNode(),
): Promise<DocumentProcessingResult> {
  return processEvent(
    runtime,
    session,
    operationRequestEvent(
      runtime,
      timelineId,
      operationName,
      request,
      session.nextTimestamp++,
    ),
    operationName,
  );
}

export function operationRequestEvent(
  runtime: ScenarioRuntime,
  timelineId: string,
  operationName: string,
  request: BlueNode = new BlueNode(),
  timestamp = 1,
): BlueNode {
  const message = obj({
    operation: text(operationName),
    request,
  }).setType(typeValue('Coordination/Operation Request'));

  const event = obj({
    timeline: obj({
      timelineId: text(timelineId),
    }).setType(typeValue('Coordination/Timeline')),
    timestamp: integer(timestamp),
    message,
  }).setType(typeValue('Coordination/Timeline Entry'));

  const preprocessed = runtime.blue.preprocess(event);
  preprocessed.setBlue(undefined);
  return preprocessed;
}

export function requireSuccess(
  step: string,
  result: DocumentProcessingResult,
): DocumentProcessingResult {
  if (result.capabilityFailure) {
    throw new Error(`${step} failed: ${result.failureReason ?? 'unknown'}`);
  }
  return result;
}

export function obj(properties: Record<string, BlueNode>): BlueNode {
  return new BlueNode().setProperties(properties);
}

export function list(items: readonly BlueNode[]): BlueNode {
  return new BlueNode().setItems([...items]);
}

export function text(value: string): BlueNode {
  return new BlueNode().setValue(value).setInlineValue(true);
}

export function integer(value: number): BlueNode {
  return new BlueNode().setValue(value).setInlineValue(true);
}

export function bool(value: boolean): BlueNode {
  return new BlueNode().setValue(value).setInlineValue(true);
}

export function typeValue(qualifiedType: string): BlueNode {
  return new BlueNode().setValue(qualifiedType).setInlineValue(true);
}

export function eventNode(
  qualifiedType: string,
  properties: Record<string, BlueNode> = {},
): BlueNode {
  return obj(properties).setType(typeValue(qualifiedType));
}

export function putPath(node: BlueNode, path: string, value: BlueNode): void {
  const segments = pointerSegments(path);
  if (segments.length === 0) {
    throw new Error('Cannot replace root scenario document in place');
  }

  let current = node;
  for (const segment of segments.slice(0, -1)) {
    const index = numericIndex(segment);
    if (index !== null) {
      const items = current.getItems();
      if (!items?.[index]) {
        throw new Error(`Missing list segment ${segment} in ${path}`);
      }
      current = items[index];
      continue;
    }

    const properties = current.getProperties();
    let child = properties?.[segment];
    if (!child) {
      const nextProperties = { ...(properties ?? {}) };
      child = new BlueNode().setProperties({});
      nextProperties[segment] = child;
      current.setProperties(nextProperties);
    }
    current = child;
  }

  const leaf = segments[segments.length - 1];
  const leafIndex = numericIndex(leaf);
  if (leafIndex !== null) {
    const items = current.getItems();
    if (!items) {
      throw new Error(`Missing list for ${path}`);
    }
    items[leafIndex] = value;
    return;
  }

  const properties = current.getProperties() ?? {};
  properties[leaf] = value;
  current.setProperties(properties);
}

export function valueAt(node: BlueNode, path: string): unknown {
  try {
    const value = node.get(path);
    return simplify(value);
  } catch {
    return undefined;
  }
}

export function sessionValue(session: ScenarioSession, path: string): unknown {
  return valueAt(session.current.document, path);
}

export function typeName(runtime: ScenarioRuntime, node: BlueNode): string {
  const type = node.getType();
  const value = type?.getValue();
  if (value !== undefined && value !== null) {
    return String(value);
  }
  const blueId = type?.getReferenceBlueId();
  return blueId === undefined
    ? 'untyped'
    : (runtime.blue.getTypeAliasByBlueId(blueId) ?? `blueId:${blueId}`);
}

export function hasEventType(
  runtime: ScenarioRuntime,
  events: readonly BlueNode[],
  expectedType: string,
): boolean {
  return events.some((event) => typeName(runtime, event) === expectedType);
}

export function requireEventType(
  runtime: ScenarioRuntime,
  events: readonly BlueNode[],
  expectedType: string,
  label: string,
): void {
  if (!hasEventType(runtime, events, expectedType)) {
    throw new Error(`${label} missing event ${expectedType}`);
  }
}

export function simplify(value: unknown): unknown {
  if (value instanceof BlueNode) {
    if (value.getValue() !== undefined) {
      return simplify(value.getValue());
    }
    return value;
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as { toNumber: unknown }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return value;
}

function normalizeResourcePath(resourcePath: string): string {
  return resourcePath.startsWith('/') ? resourcePath.slice(1) : resourcePath;
}

function pointerSegments(path: string): string[] {
  if (path === '' || path === '/') {
    return [];
  }
  return path
    .replace(/^\//, '')
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function numericIndex(segment: string): number | null {
  if (!/^(0|[1-9]\d*)$/.test(segment)) {
    return null;
  }
  return Number.parseInt(segment, 10);
}
