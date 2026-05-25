import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { yamlBlueParse } from '../../utils/yamlBlue';
import { Blue } from '../Blue';
import { CyclicSetIdentityService } from '../identity/CyclicSetIdentityService';
import { BlueNode } from '../model/Node';
import { NodeDeserializer } from '../model/NodeDeserializer';
import { NodeProvider, createNodeProvider } from '../NodeProvider';
import { FrozenNode } from '../snapshot/FrozenNode';
import { MergeReverser } from '../utils/MergeReverser';
import { NodeToMapListOrValue } from '../utils/NodeToMapListOrValue';
import { LIST_CONTROL_REPLACE, OBJECT_BLUE_ID } from '../utils/Properties';
import { JavaBlueIdCalculator } from './JavaBlueIdCalculator';

type FixtureOperation =
  | 'parseSource'
  | 'parseBlueIdInput'
  | 'calculateBlueId'
  | 'calculateCircularSetBlueIds'
  | 'preprocess'
  | 'resolve'
  | 'canonicalize'
  | 'calculateContentBlueId'
  | 'calculateSemanticBlueId'
  | 'expand'
  | 'collapse'
  | 'assertSameNodeBlueId';

interface FixtureEntry {
  readonly id: string;
  readonly category: string;
  readonly path: string;
}

interface FixtureSpec {
  readonly id: string;
  readonly category: string;
  readonly operation: FixtureOperation;
  readonly expectError?: boolean;
  readonly provider?: unknown;
  readonly input?: unknown;
  readonly source?: unknown;
  readonly documents?: unknown;
  readonly left?: unknown;
  readonly right?: unknown;
  readonly expectedNodeBlueId?: string;
  readonly expectedContentBlueId?: string;
  readonly expectedBlueIds?: string[];
  readonly expectedParsed?: unknown;
  readonly expectedPreprocessed?: unknown;
  readonly expectedResolved?: unknown;
  readonly expectedCanonicalOverlay?: unknown;
  readonly expectedExpanded?: unknown;
  readonly expectedCollapsed?: unknown;
  readonly alsoEquivalentTo?: unknown;
  readonly alsoDifferentFrom?: unknown;
}

const fixtureRoot = path.join(
  __dirname,
  'fixtures',
  'blue-language-1.0',
  'fixtures',
);

const manifest = readYamlFile<{ fixtures: FixtureEntry[] }>(
  path.join(fixtureRoot, 'manifest.yaml'),
);

if (process.env.CI && process.env.BLUE_FIXTURE) {
  throw new Error('BLUE_FIXTURE must not be set in CI conformance runs.');
}

const fixtureEntries = manifest.fixtures.filter((entry) => {
  const filter = process.env.BLUE_FIXTURE;
  return filter === undefined || entry.id.includes(filter);
});

describe('Java Blue Language conformance fixtures', () => {
  for (const entry of fixtureEntries) {
    it(`${entry.id} ${entry.category}`, () => {
      runFixture(entry);
    });
  }
});

function runFixture(entry: FixtureEntry): void {
  const spec = readYamlFile<FixtureSpec>(path.join(fixtureRoot, entry.path));
  expect(spec.id).toBe(entry.id);
  expect(spec.category).toBe(entry.category);

  if (spec.expectError === true) {
    expect(() => runOperation(spec)).toThrow();
    return;
  }

  const actual = runOperation(spec);
  switch (spec.operation) {
    case 'calculateBlueId':
    case 'assertSameNodeBlueId':
      expect(actual).toBe(
        required(spec.expectedNodeBlueId, 'expectedNodeBlueId'),
      );
      if (spec.operation === 'calculateBlueId') {
        assertEquivalentBlueIds(actual as string, spec.alsoEquivalentTo);
        assertDifferentBlueIds(actual as string, spec.alsoDifferentFrom);
      }
      return;
    case 'calculateCircularSetBlueIds':
      expect(actual).toEqual(required(spec.expectedBlueIds, 'expectedBlueIds'));
      return;
    case 'calculateContentBlueId':
    case 'calculateSemanticBlueId':
      expect(actual).toBe(
        required(spec.expectedContentBlueId, 'expectedContentBlueId'),
      );
      return;
    case 'parseSource':
    case 'parseBlueIdInput':
      assertExpectedNode(spec.expectedParsed, actual as BlueNode);
      return;
    case 'preprocess':
      assertExpectedNode(spec.expectedPreprocessed, actual as BlueNode);
      return;
    case 'resolve':
      assertExpectedNode(spec.expectedResolved, actual as BlueNode);
      return;
    case 'canonicalize':
      assertExpectedNode(spec.expectedCanonicalOverlay, actual as BlueNode);
      assertCanonicalOverlayIsValidBlueIdInput(actual as BlueNode);
      return;
    case 'expand':
      assertExpectedNode(spec.expectedExpanded, actual as BlueNode);
      assertExpectedNodeBlueIdIfPresent(spec, actual as BlueNode, spec.source);
      return;
    case 'collapse':
      assertExpectedNode(spec.expectedCollapsed, actual as BlueNode);
      assertExpectedNodeBlueIdIfPresent(spec, actual as BlueNode, spec.source);
      return;
  }
}

function runOperation(spec: FixtureSpec): unknown {
  const blue = new Blue({ nodeProvider: provider(spec.provider) });
  switch (spec.operation) {
    case 'parseSource':
      return readNode(required(spec.source, 'source'));
    case 'parseBlueIdInput': {
      const node = readNode(required(spec.input, 'input'));
      JavaBlueIdCalculator.calculateBlueIdSync(node);
      return node;
    }
    case 'calculateBlueId': {
      const input = readNode(required(spec.input, 'input'));
      const blueId = JavaBlueIdCalculator.calculateBlueIdSync(input);
      expect(FrozenNode.fromNode(input).blueId()).toBe(blueId);
      return blueId;
    }
    case 'calculateCircularSetBlueIds': {
      const documents = readNode(required(spec.documents, 'documents'));
      const items = documents.getItems();
      if (items === undefined) {
        throw new Error('calculateCircularSetBlueIds requires documents list.');
      }
      return new CyclicSetIdentityService({
        calculateBlueId: (node) =>
          Array.isArray(node)
            ? JavaBlueIdCalculator.calculateListBlueIdAllowingCyclicPlaceholdersSync(
                node,
              )
            : JavaBlueIdCalculator.calculateBlueIdAllowingCyclicPlaceholdersSync(
                node,
              ),
      }).calculate(items).documentBlueIds;
    }
    case 'preprocess':
      return blue.preprocess(readNode(required(spec.source, 'source')));
    case 'resolve':
      return blue.resolve(readNode(required(spec.source, 'source')));
    case 'canonicalize':
      return canonicalize(blue, readNode(required(spec.source, 'source')));
    case 'calculateContentBlueId':
    case 'calculateSemanticBlueId':
      return JavaBlueIdCalculator.calculateBlueIdSync(
        canonicalize(blue, readNode(required(spec.source, 'source'))),
      );
    case 'expand':
      return expandReferences(readNode(required(spec.source, 'source')), blue);
    case 'collapse':
      return new BlueNode().setReferenceBlueId(
        JavaBlueIdCalculator.calculateBlueIdSync(
          readNode(required(spec.source, 'source')),
        ),
      );
    case 'assertSameNodeBlueId': {
      const left = JavaBlueIdCalculator.calculateBlueIdSync(
        readNode(required(spec.left, 'left')),
      );
      const right = JavaBlueIdCalculator.calculateBlueIdSync(
        readNode(required(spec.right, 'right')),
      );
      expect(left).toBe(right);
      return left;
    }
  }
}

function canonicalize(blue: Blue, node: BlueNode): BlueNode {
  return new MergeReverser().reverseToCanonicalOverlay(
    blue.resolve(blue.preprocess(node.clone())),
  );
}

function provider(providerSpec: unknown): NodeProvider {
  if (providerSpec === undefined || providerSpec === null) {
    return createNodeProvider(() => []);
  }
  if (!Array.isArray(providerSpec)) {
    throw new Error('Fixture provider must be a list.');
  }

  const nodesByBlueId = new Map<string, BlueNode>();
  for (const entry of providerSpec) {
    if (!isObject(entry)) {
      throw new Error('Fixture provider entry must be an object.');
    }
    const requestedBlueId = String(entry.requestedBlueId ?? entry.blueId ?? '');
    const nodeSpec = entry.returnedNode ?? entry.node;
    if (requestedBlueId.length === 0 || nodeSpec === undefined) {
      throw new Error(
        'Fixture provider entries require requestedBlueId and node/returnedNode.',
      );
    }
    nodesByBlueId.set(requestedBlueId, readNode(nodeSpec));
  }

  return createNodeProvider((blueId) => {
    const node = nodesByBlueId.get(blueId);
    return node === undefined ? [] : [node.clone()];
  });
}

function expandReferences(node: BlueNode, blue: Blue): BlueNode {
  if (isReferenceOnly(node)) {
    const referenceBlueId = node.getReferenceBlueId();
    const fetched = referenceBlueId
      ? blue.getNodeProvider().fetchByBlueId(referenceBlueId)
      : null;
    if (fetched === null || fetched.length === 0) {
      throw new Error(`No content found for blueId: ${referenceBlueId}`);
    }
    if (fetched.length === 1) {
      return expandReferences(
        providerContentWithoutRootIdentity(fetched[0]),
        blue,
      );
    }
    return new BlueNode().setItems(
      fetched.map((item) =>
        expandReferences(providerContentWithoutRootIdentity(item), blue),
      ),
    );
  }

  const expanded = node.clone();
  expanded.setType(wrapExpanded(expanded.getType(), blue));
  expanded.setItemType(wrapExpanded(expanded.getItemType(), blue));
  expanded.setKeyType(wrapExpanded(expanded.getKeyType(), blue));
  expanded.setValueType(wrapExpanded(expanded.getValueType(), blue));
  expanded.setBlue(wrapExpanded(expanded.getBlue(), blue));
  expanded.setContractsNode(wrapExpanded(expanded.getContractsNode(), blue));
  if (expanded.getItems() !== undefined) {
    expanded.setItems(
      expanded.getItems()?.map((item) => expandReferences(item, blue)),
    );
  }
  if (expanded.getProperties() !== undefined) {
    expanded.setProperties(
      Object.fromEntries(
        Object.entries(expanded.getProperties() ?? {}).map(([key, value]) => [
          key,
          expandReferences(value, blue),
        ]),
      ),
    );
  }
  return expanded;
}

function wrapExpanded(
  node: BlueNode | undefined,
  blue: Blue,
): BlueNode | undefined {
  return node === undefined ? undefined : expandReferences(node, blue);
}

function providerContentWithoutRootIdentity(node: BlueNode): BlueNode {
  const canonical = node.clone();
  if (
    canonical.getReferenceBlueId() !== undefined &&
    !isReferenceOnly(canonical)
  ) {
    canonical.setReferenceBlueId(undefined);
  }
  return canonical;
}

function assertExpectedNode(expectedSpec: unknown, actual: BlueNode): void {
  const expected = serializeNode(
    readNode(required(expectedSpec, 'expectedNode')),
  );
  expect(serializeNode(actual)).toEqual(expected);
}

function assertExpectedNodeBlueIdIfPresent(
  spec: FixtureSpec,
  actual: BlueNode,
  source: unknown,
): void {
  if (spec.expectedNodeBlueId === undefined) {
    return;
  }
  expect(JavaBlueIdCalculator.calculateBlueIdSync(actual)).toBe(
    spec.expectedNodeBlueId,
  );
  expect(
    JavaBlueIdCalculator.calculateBlueIdSync(
      readNode(required(source, 'source')),
    ),
  ).toBe(spec.expectedNodeBlueId);
}

function assertEquivalentBlueIds(
  actualBlueId: string,
  equivalent: unknown,
): void {
  if (equivalent === undefined || equivalent === null) {
    return;
  }
  const equivalents = Array.isArray(equivalent) ? equivalent : [equivalent];
  for (const item of equivalents) {
    expect(JavaBlueIdCalculator.calculateBlueIdSync(readNode(item))).toBe(
      actualBlueId,
    );
  }
}

function assertDifferentBlueIds(
  actualBlueId: string,
  different: unknown,
): void {
  if (different === undefined || different === null) {
    return;
  }
  const differentInputs = Array.isArray(different) ? different : [different];
  for (const item of differentInputs) {
    expect(JavaBlueIdCalculator.calculateBlueIdSync(readNode(item))).not.toBe(
      actualBlueId,
    );
  }
}

function assertCanonicalOverlayIsValidBlueIdInput(node: BlueNode): void {
  JavaBlueIdCalculator.calculateBlueIdSync(node);
  assertNoCanonicalOverlayControls(node, '/', false);
}

function assertNoCanonicalOverlayControls(
  node: BlueNode | undefined,
  pointer: string,
  listElement: boolean,
): void {
  if (node === undefined) {
    return;
  }
  if (node.getBlue() !== undefined) {
    throw new Error(`Canonical Overlay contains blue at ${pointer}`);
  }
  if (node.getPreviousBlueId() !== undefined) {
    throw new Error(`Canonical Overlay contains $previous at ${pointer}`);
  }
  if (node.getPosition() !== undefined) {
    throw new Error(`Canonical Overlay contains $pos at ${pointer}`);
  }
  if (node.getProperties()?.[LIST_CONTROL_REPLACE] !== undefined) {
    throw new Error(`Canonical Overlay contains $replace at ${pointer}`);
  }
  if (listElement && isEmptyNode(node) && !isEmptyPlaceholder(node)) {
    throw new Error(
      `Canonical Overlay contains empty-object list element at ${pointer}`,
    );
  }
  assertNoCanonicalOverlayControls(
    node.getType(),
    appendPath(pointer, 'type'),
    false,
  );
  assertNoCanonicalOverlayControls(
    node.getItemType(),
    appendPath(pointer, 'itemType'),
    false,
  );
  assertNoCanonicalOverlayControls(
    node.getKeyType(),
    appendPath(pointer, 'keyType'),
    false,
  );
  assertNoCanonicalOverlayControls(
    node.getValueType(),
    appendPath(pointer, 'valueType'),
    false,
  );
  assertNoCanonicalOverlayControls(
    node.getContractsNode(),
    appendPath(pointer, 'contracts'),
    false,
  );
  node
    .getItems()
    ?.forEach((item, index) =>
      assertNoCanonicalOverlayControls(
        item,
        appendPath(pointer, String(index)),
        true,
      ),
    );
  for (const [key, value] of Object.entries(node.getProperties() ?? {})) {
    assertNoCanonicalOverlayControls(value, appendPath(pointer, key), false);
  }
}

function serializeNode(node: BlueNode): unknown {
  return NodeToMapListOrValue.get(node, 'official');
}

function readNode(value: unknown): BlueNode {
  return NodeDeserializer.deserialize(value);
}

function readYamlFile<T>(filePath: string): T {
  return required(
    yamlBlueParse(fs.readFileSync(filePath, 'utf8')),
    filePath,
  ) as T;
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Fixture is missing required field: ${label}`);
  }
  return value;
}

function isReferenceOnly(node: BlueNode): boolean {
  return (
    node.getReferenceBlueId() !== undefined &&
    node.getName() === undefined &&
    node.getDescription() === undefined &&
    node.getType() === undefined &&
    node.getItemType() === undefined &&
    node.getKeyType() === undefined &&
    node.getValueType() === undefined &&
    node.getValue() === undefined &&
    node.getItems() === undefined &&
    node.getProperties() === undefined &&
    node.getContractsNode() === undefined &&
    node.getSchema() === undefined &&
    node.getMergePolicy() === undefined
  );
}

function isEmptyNode(node: BlueNode): boolean {
  return (
    node.getName() === undefined &&
    node.getDescription() === undefined &&
    node.getType() === undefined &&
    node.getItemType() === undefined &&
    node.getKeyType() === undefined &&
    node.getValueType() === undefined &&
    node.getValue() === undefined &&
    node.getItems() === undefined &&
    node.getProperties() === undefined &&
    node.getContractsNode() === undefined &&
    node.getReferenceBlueId() === undefined &&
    node.getSchema() === undefined &&
    node.getMergePolicy() === undefined
  );
}

function isEmptyPlaceholder(node: BlueNode): boolean {
  const properties = node.getProperties();
  return (
    properties !== undefined &&
    Object.keys(properties).length === 1 &&
    properties.$empty?.getValue() === true
  );
}

function appendPath(pointer: string, segment: string): string {
  return pointer === '/' || pointer.length === 0
    ? `/${segment}`
    : `${pointer}/${segment}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
