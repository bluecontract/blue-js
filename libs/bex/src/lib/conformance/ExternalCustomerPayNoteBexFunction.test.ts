import fs from 'node:fs';
import path from 'node:path';
import { BlueNode } from '@blue-labs/language';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { BexEngine } from '../api/BexEngine';
import { BexExecutionContext } from '../api/BexExecutionContext';
import { BexProgramSource } from '../api/BexProgramSource';
import { BexValues } from '../value/BexValues';

const fixtureRoot = path.join(__dirname, 'fixtures', 'external');

describe('External customer PayNote BEX function fixture', () => {
  it('executes the snapshot-resolved entry function with the attached event', () => {
    const programDocument = parseNode(
      readFixture('customer-paynote-snapshot-bex-functions.yaml'),
    );
    const eventEnvelope = parseNode(
      readFixture('customer-paynote-snapshot-event.yaml'),
    );
    const programNode = requiredNode(
      programDocument,
      '/contracts/processPackageCustomerPayNoteSnapshotResolved/steps/0',
    );
    const definitionNode = requiredNode(
      programDocument,
      '/contracts/packageFulfillmentBexDefinition',
    );
    const matchedEvent = requiredNode(eventEnvelope, '/message/request/0');

    expect(valueAt(programNode, '/entry')).toBe(
      'processCustomerPayNoteSnapshotResolved',
    );
    expect(valueAt(matchedEvent, '/inResponseTo/requestId')).toBe(
      'snapshot:customer-paynote:customer-paynote-a',
    );
    expect(valueAt(matchedEvent, '/targetSessionId')).toBe(
      'customer-paynote-a',
    );

    const result = BexEngine.builder()
      .build()
      .compileAndExecute(
        BexProgramSource.withDefinition(
          programNode,
          definitionNode,
          'processCustomerPayNoteSnapshotResolved',
        ),
        BexExecutionContext.builder()
          .document(programDocument)
          .event(BexValues.nodeSnapshot(matchedEvent))
          .currentContract(BexValues.nodeSnapshot(definitionNode))
          .gasLimit(100_000_000)
          .build(),
      );

    const paths = result.changeset.toSimple().map((entry) => entry.path);
    expect(paths).toContain(
      '/customerPayNoteRefsBySessionId/customer-paynote-a',
    );
    expect(paths).toContain(
      '/orders/package-order-a/customerPayNote/sessionId',
    );
    expect(paths).toContain(
      '/orders/package-order-a/customerPayNote/snapshotRequestId',
    );
    expect(paths).toContain(
      '/orders/package-order-a/customerPayNote/subscriptionId',
    );
    expect(paths).toContain('/orders/package-order-a/customerPayNote/secured');
    expect(paths).toContain(
      '/orders/package-order-a/customerPayNote/securedAmount',
    );
    expect(paths).toContain(
      '/orders/package-order-a/customerPayNote/attachedToPackageOrder',
    );

    const refPatch = patchAt(
      result,
      '/customerPayNoteRefsBySessionId/customer-paynote-a',
    );
    expect(refPatch.op).toBe('add');
    expect(valueAtSimple(refPatch.val, '/sessionId')).toBe(
      'customer-paynote-a',
    );
    expect(valueAtSimple(refPatch.val, '/packageOrderSessionId')).toBe(
      'package-order-a',
    );
    expect(valueAtSimple(refPatch.val, '/packageOrderDocumentId')).toBe(
      'zzimVxhnKLL5SwMkS9kmF8p5g7pyxPWBu664HxGbszB',
    );
    expect(valueAtSimple(refPatch.val, '/snapshotRequestId')).toBe(
      'snapshot:customer-paynote:customer-paynote-a',
    );
    expect(valueAtSimple(refPatch.val, '/subscriptionId')).toBe(
      'package-linked:customer-paynote-a',
    );

    expect(
      patchAt(result, '/orders/package-order-a/customerPayNote/sessionId').val,
    ).toBe('customer-paynote-a');
    expect(
      patchAt(
        result,
        '/orders/package-order-a/customerPayNote/snapshotRequestId',
      ).val,
    ).toBe('snapshot:customer-paynote:customer-paynote-a');
    expect(
      patchAt(result, '/orders/package-order-a/customerPayNote/subscriptionId')
        .val,
    ).toBe('package-linked:customer-paynote-a');
    expect(
      patchAt(result, '/orders/package-order-a/customerPayNote/secured').val,
    ).toBe(true);
    expect(
      String(
        patchAt(result, '/orders/package-order-a/customerPayNote/securedAmount')
          .val,
      ),
    ).toBe('100000');
    expect(
      patchAt(
        result,
        '/orders/package-order-a/customerPayNote/attachedToPackageOrder',
      ).val,
    ).toBe(true);

    const attachEvent = findEvent(result.events.toSimple(), 'attachPayNote');
    expect(attachEvent).toBeDefined();
    expect(valueAtSimple(attachEvent, '/type')).toBe(
      'MyOS/Call Operation Requested',
    );
    expect(valueAtSimple(attachEvent, '/onBehalfOf')).toBe('investorChannel');
    expect(valueAtSimple(attachEvent, '/targetSessionId')).toBe(
      'package-order-a',
    );
    expect(valueAtSimple(attachEvent, '/request/payNoteSessionId')).toBe(
      'customer-paynote-a',
    );
    expect(
      valueAtSimple(
        attachEvent,
        '/request/initialSnapshot/context/paymentKind',
      ),
    ).toBe('customer_package_purchase');

    expect(result.gasUsed).toBeGreaterThan(0);
    expect(result.metrics.eventReads).toBeGreaterThan(0);
    expect(result.metrics.documentReads).toBeGreaterThan(0);
    expect(result.metrics.resultValueReads).toBeGreaterThan(0);
    expect(result.metrics.functionCalls).toBeGreaterThan(1);
    expect(result.metrics.patchAppends).toBe(
      result.changeset.toSimple().length,
    );
    expect(result.metrics.eventAppends).toBe(result.events.toSimple().length);
    expect(result.changeset.toSimple()).toHaveLength(
      (result.value.toSimple() as { changeset: unknown[] }).changeset.length,
    );
    expect(result.events.toSimple()).toHaveLength(
      (result.value.toSimple() as { events: unknown[] }).events.length,
    );
  });
});

function readFixture(file: string): string {
  return fs.readFileSync(path.join(fixtureRoot, file), 'utf8');
}

function parseNode(source: string): BlueNode {
  return simpleToNode(yaml.load(source));
}

function simpleToNode(value: unknown): BlueNode {
  if (value === undefined) {
    return new BlueNode();
  }
  if (value === null) {
    return new BlueNode().setValue(null);
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return new BlueNode().setValue(value);
  }
  if (Array.isArray(value)) {
    return new BlueNode().setItems(value.map(simpleToNode));
  }
  const result = new BlueNode();
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    result.addProperty(key, simpleToNode(child));
  }
  return result;
}

function requiredNode(root: BlueNode, pointer: string): BlueNode {
  const node = nodeAt(root, pointer);
  expect(node, `Missing node at ${pointer}`).toBeInstanceOf(BlueNode);
  return node as BlueNode;
}

function nodeAt(root: BlueNode, pointer: string): BlueNode | undefined {
  let current: BlueNode | undefined = root;
  for (const segment of pointerSegments(pointer)) {
    if (current === undefined) {
      return undefined;
    }
    const properties = current.getProperties();
    if (properties) {
      current = properties[segment];
      continue;
    }
    const items = current.getItems();
    const index = Number(segment);
    current =
      items && Number.isInteger(index) && index >= 0 ? items[index] : undefined;
  }
  return current;
}

function valueAt(root: BlueNode, pointer: string): string {
  const value = requiredNode(root, pointer).getValue();
  expect(value, `Expected scalar value at ${pointer}`).not.toBeUndefined();
  return String(value);
}

function patchAt(
  result: { changeset: { toSimple(): Array<{ path: string }> } },
  path: string,
): { op?: string; path: string; val?: unknown } {
  const entry = result.changeset.toSimple().find((item) => item.path === path);
  if (!entry) {
    throw new Error(
      `Missing patch at ${path}; got ${result.changeset
        .toSimple()
        .map((item) => item.path)
        .join(', ')}`,
    );
  }
  return entry;
}

function findEvent(events: unknown[], operation: string): unknown {
  return events.find(
    (event) => valueAtSimple(event, '/operation') === operation,
  );
}

function valueAtSimple(root: unknown, pointer: string): string {
  const value = pointerSegments(pointer).reduce((current, segment) => {
    if (
      current !== null &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      return (current as Record<string, unknown>)[segment];
    }
    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }
    return undefined;
  }, root);
  expect(value, `Missing simple value at ${pointer}`).not.toBeUndefined();
  return String(value);
}

function pointerSegments(pointer: string): string[] {
  if (pointer === '' || pointer === '/') {
    return [];
  }
  return pointer
    .replace(/^\//, '')
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}
