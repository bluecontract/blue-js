import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from './conformance-expect.js';
import { yamlBlueParse } from '../../utils/yamlBlue';
import { Blue } from '../Blue';
import { CyclicSetIdentityService } from '../identity/CyclicSetIdentityService';
import { BlueNode } from '../model/Node';
import { NodeDeserializer } from '../model/NodeDeserializer';
import { NodeProvider, createNodeProvider } from '../NodeProvider';
import { FrozenNode } from '../snapshot/FrozenNode';
import { MergeReverser } from '../utils/MergeReverser';
import { NodeToMapListOrValue } from '../utils/NodeToMapListOrValue';
import {
  blueLanguageErrorCategory,
  type BlueLanguageErrorCategory,
} from '../errors/BlueError';
import {
  CORE_TYPE_NAME_TO_BLUE_ID_MAP,
  LIST_CONTROL_REPLACE,
} from '../utils/Properties';
import {
  BLUE_LANGUAGE_1_0_FIXTURE_PACKAGE_IDENTITY,
  BlueLanguageConformanceReport,
  fixturePackageIdentityMatchesFixtureFiles,
  hasExactRequiredFixtureSet,
  hasRequiredFixtureCoverage,
  loadLanguageConformanceFixtureEntries,
  type BlueLanguageConformanceFailure,
  type BlueLanguageFixtureEntry,
} from './BlueLanguageConformanceReport';
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
  | 'assertSameNodeBlueId'
  | 'registryNodeHashesToPublishedBlueId'
  | 'changingRegistryDescriptionChangesBlueId'
  | 'lintPublishableDocumentation'
  | 'assertViewPath';

export type FixtureBlueLanguageErrorCategory = BlueLanguageErrorCategory;

export interface LanguageFixtureEntry {
  readonly id: string;
  readonly category: string;
  readonly path: string;
}

export interface LanguageFixtureSpec {
  readonly id: string;
  readonly category: string;
  readonly operation: string;
  readonly description?: string;
  readonly expectError?: boolean;
  readonly expectedErrorCategory?: FixtureBlueLanguageErrorCategory;
  readonly expectedErrorCategories?: FixtureBlueLanguageErrorCategory[];
  readonly provider?: unknown;
  readonly input?: unknown;
  readonly source?: unknown;
  readonly document?: unknown;
  readonly documents?: unknown;
  readonly left?: unknown;
  readonly right?: unknown;
  readonly assertions?: ViewPathAssertion[];
  readonly expectedNodeBlueId?: string;
  readonly expectedContentBlueId?: string;
  readonly expectedBlueIds?: string[];
  readonly expectedPublishedBlueId?: string;
  readonly expectedParsed?: unknown;
  readonly expectedPreprocessed?: unknown;
  readonly expectedResolved?: unknown;
  readonly expectedCanonicalOverlay?: unknown;
  readonly expectedExpanded?: unknown;
  readonly expectedCollapsed?: unknown;
  readonly alsoEquivalentTo?: unknown;
  readonly alsoDifferentFrom?: unknown;
  readonly registryKind?: string;
  readonly registryKey?: string;
  readonly semanticDescriptionIdentityBearing?: boolean;
  readonly mutation?: RegistryMutation;
  readonly expectBlueIdChanged?: boolean;
  readonly publishableFiles?: string[];
  readonly requiredHeadings?: string[];
  readonly forbiddenJoinedTerms?: ForbiddenJoinedTerm[];
  readonly matchRule?: string;
}

interface RegistryMutation {
  readonly field: string;
  readonly append?: string;
}

interface ForbiddenJoinedTerm {
  readonly tokens: string[];
  readonly joiner: string;
}

interface ViewPathAssertion {
  readonly path: string;
  readonly expectedRoot?: boolean;
  readonly expectedNode?: unknown;
}

// @ts-expect-error Vite resolves import.meta.url for both package output formats.
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const fixturePackageRoot = resolveExistingDirectory([
  path.join(moduleDir, 'fixtures/blue-language-1.0'),
  path.join(moduleDir, 'lib/conformance/fixtures/blue-language-1.0'),
  path.resolve(
    process.cwd(),
    'libs/language/src/lib/conformance/fixtures/blue-language-1.0',
  ),
]);
const fixtureRoot = path.join(fixturePackageRoot, 'fixtures');
const registryRoot = path.join(
  fixturePackageRoot,
  'registry',
  'blue-language-1.0',
);

const supportedOperations = new Set<string>([
  'parseSource',
  'parseBlueIdInput',
  'calculateBlueId',
  'calculateCircularSetBlueIds',
  'preprocess',
  'resolve',
  'canonicalize',
  'calculateContentBlueId',
  'calculateSemanticBlueId',
  'expand',
  'collapse',
  'assertSameNodeBlueId',
  'registryNodeHashesToPublishedBlueId',
  'changingRegistryDescriptionChangesBlueId',
  'lintPublishableDocumentation',
  'assertViewPath',
]);

const knownFixtureFields = new Set([
  'alsoDifferentFrom',
  'alsoEquivalentTo',
  'assertions',
  'category',
  'description',
  'document',
  'documents',
  'expectBlueIdChanged',
  'expectError',
  'expectedBlueIds',
  'expectedCanonicalOverlay',
  'expectedCollapsed',
  'expectedContentBlueId',
  'expectedErrorCategories',
  'expectedErrorCategory',
  'expectedExpanded',
  'expectedNodeBlueId',
  'expectedParsed',
  'expectedPreprocessed',
  'expectedPublishedBlueId',
  'expectedResolved',
  'forbiddenJoinedTerms',
  'id',
  'input',
  'left',
  'matchRule',
  'mutation',
  'operation',
  'provider',
  'publishableFiles',
  'registryKey',
  'registryKind',
  'requiredHeadings',
  'right',
  'semanticDescriptionIdentityBearing',
  'source',
]);

const coreRegistryFiles = {
  Boolean: 'Boolean.blue',
  Dictionary: 'Dictionary.blue',
  Double: 'Double.blue',
  Integer: 'Integer.blue',
  List: 'List.blue',
  Text: 'Text.blue',
} as const satisfies Record<keyof typeof CORE_TYPE_NAME_TO_BLUE_ID_MAP, string>;

const manifest = readYamlFile<{ fixtures: LanguageFixtureEntry[] }>(
  path.join(fixtureRoot, 'manifest.yaml'),
);

if (process.env.CI && process.env.BLUE_FIXTURE) {
  throw new Error('BLUE_FIXTURE must not be set in CI conformance runs.');
}

const fixtureEntries = manifest.fixtures.filter((entry) => {
  const filter = process.env.BLUE_FIXTURE;
  return filter === undefined || entry.id.includes(filter);
});

export function languageConformanceFixtureEntries(): LanguageFixtureEntry[] {
  return [...fixtureEntries];
}

export interface ConformanceOptions {
  readonly mutateFixture?: (
    entry: BlueLanguageFixtureEntry,
    spec: LanguageFixtureSpec,
  ) => LanguageFixtureSpec;
}

export async function runLanguageConformanceSuite(
  options: ConformanceOptions = {},
): Promise<BlueLanguageConformanceReport> {
  const entries = loadLanguageConformanceFixtureEntries();
  const identityMatches = fixturePackageIdentityMatchesFixtureFiles();
  const requiredCoverage = hasRequiredFixtureCoverage();
  const exactFixtureSet = hasExactRequiredFixtureSet();
  const failures: BlueLanguageConformanceFailure[] = [];
  const passed: string[] = [];

  if (!identityMatches) {
    failures.push(
      failure('manifest', 'Manifest', 'identity', 'identity mismatch'),
    );
  }
  if (!requiredCoverage) {
    failures.push(
      failure(
        'manifest',
        'Manifest',
        'coverage',
        'fixture coverage is incomplete',
      ),
    );
  }
  if (!exactFixtureSet) {
    failures.push(
      failure(
        'manifest',
        'Manifest',
        'fixture-set',
        'fixture set is not exact',
      ),
    );
  }

  for (const entry of entries) {
    try {
      runLanguageFixtureEntry(entry, options.mutateFixture);
      passed.push(entry.id);
    } catch (error) {
      failures.push(
        failure(
          entry.id,
          entry.category,
          entry.operation ?? 'unknown',
          formatError(error),
          error,
        ),
      );
    }
  }

  return new BlueLanguageConformanceReport(
    '1.0',
    BLUE_LANGUAGE_1_0_FIXTURE_PACKAGE_IDENTITY,
    passed,
    failures,
    identityMatches,
    requiredCoverage,
    exactFixtureSet,
  );
}

function failure(
  fixtureId: string,
  category: string,
  operation: string,
  message: string,
  cause?: unknown,
): BlueLanguageConformanceFailure {
  return {
    fixtureId,
    category,
    operation,
    message,
    cause: cause instanceof Error ? cause.message : undefined,
    classification: cause instanceof Error ? cause.name : undefined,
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function runLanguageFixtureEntry(
  entry: LanguageFixtureEntry,
  mutateFixture?: (
    entry: LanguageFixtureEntry,
    spec: LanguageFixtureSpec,
  ) => LanguageFixtureSpec,
): void {
  const loaded = readYamlFile<LanguageFixtureSpec>(
    path.join(fixtureRoot, entry.path),
  );
  const spec = mutateFixture?.(entry, loaded) ?? loaded;
  expect(spec.id).toBe(entry.id);
  expect(spec.category).toBe(entry.category);
  runLanguageFixtureSpec(spec);
}

export function runLanguageFixtureSpec(spec: LanguageFixtureSpec): void {
  assertKnownFixtureFields(spec);
  assertSupportedOperation(spec.operation);

  if (spec.expectError === true) {
    assertOperationThrowsExpectedError(spec);
    return;
  }

  assertFixtureHasExpectedAssertion(spec);
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
    case 'registryNodeHashesToPublishedBlueId':
      expect(actual).toBe(
        required(spec.expectedPublishedBlueId, 'expectedPublishedBlueId'),
      );
      return;
    case 'changingRegistryDescriptionChangesBlueId':
      expect(actual).toBe(
        required(spec.expectBlueIdChanged, 'expectBlueIdChanged'),
      );
      return;
    case 'lintPublishableDocumentation':
    case 'assertViewPath':
      expect(actual).toBe(true);
      return;
  }
}

function runOperation(spec: LanguageFixtureSpec): unknown {
  assertSupportedOperation(spec.operation);
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
    case 'registryNodeHashesToPublishedBlueId':
      return calculatePublishedRegistryBlueId(spec);
    case 'changingRegistryDescriptionChangesBlueId':
      return changingRegistryDescriptionChangesBlueId(spec);
    case 'lintPublishableDocumentation':
      lintPublishableDocumentation(spec);
      return true;
    case 'assertViewPath':
      assertViewPath(spec);
      return true;
  }
}

function assertKnownFixtureFields(spec: LanguageFixtureSpec): void {
  for (const field of Object.keys(spec)) {
    if (!knownFixtureFields.has(field)) {
      throw new Error(`Unsupported fixture field "${field}" in ${spec.id}.`);
    }
  }
}

function assertFixtureHasExpectedAssertion(spec: LanguageFixtureSpec): void {
  assertSupportedOperation(spec.operation);
  switch (spec.operation) {
    case 'calculateBlueId':
    case 'assertSameNodeBlueId':
      required(spec.expectedNodeBlueId, 'expectedNodeBlueId');
      return;
    case 'calculateCircularSetBlueIds':
      required(spec.expectedBlueIds, 'expectedBlueIds');
      return;
    case 'calculateContentBlueId':
    case 'calculateSemanticBlueId':
      required(spec.expectedContentBlueId, 'expectedContentBlueId');
      return;
    case 'parseSource':
    case 'parseBlueIdInput':
      required(spec.expectedParsed, 'expectedParsed');
      return;
    case 'preprocess':
      required(spec.expectedPreprocessed, 'expectedPreprocessed');
      return;
    case 'resolve':
      required(spec.expectedResolved, 'expectedResolved');
      return;
    case 'canonicalize':
      required(spec.expectedCanonicalOverlay, 'expectedCanonicalOverlay');
      return;
    case 'expand':
      required(spec.expectedExpanded, 'expectedExpanded');
      return;
    case 'collapse':
      required(spec.expectedCollapsed, 'expectedCollapsed');
      return;
    case 'registryNodeHashesToPublishedBlueId':
      required(spec.expectedPublishedBlueId, 'expectedPublishedBlueId');
      return;
    case 'changingRegistryDescriptionChangesBlueId':
      required(spec.expectBlueIdChanged, 'expectBlueIdChanged');
      return;
    case 'lintPublishableDocumentation':
      required(spec.publishableFiles, 'publishableFiles');
      if (
        (spec.requiredHeadings?.length ?? 0) === 0 &&
        (spec.forbiddenJoinedTerms?.length ?? 0) === 0
      ) {
        throw new Error(
          'lintPublishableDocumentation requires at least one lint assertion.',
        );
      }
      return;
    case 'assertViewPath':
      required(spec.assertions, 'assertions');
      return;
  }
}

function assertSupportedOperation(
  operation: string,
): asserts operation is FixtureOperation {
  if (!supportedOperations.has(operation)) {
    throw new Error(
      `Unsupported Blue Language fixture operation: ${operation}`,
    );
  }
}

function assertOperationThrowsExpectedError(spec: LanguageFixtureSpec): void {
  let thrown: unknown;
  try {
    runOperation(spec);
  } catch (error) {
    thrown = error;
  }

  if (thrown === undefined) {
    throw new Error(
      `Fixture ${spec.id} expected an error, but none was thrown.`,
    );
  }

  assertExpectedErrorCategory(spec, thrown);
}

function assertExpectedErrorCategory(
  spec: LanguageFixtureSpec,
  error: unknown,
): void {
  const expectedCategories = [
    ...(spec.expectedErrorCategory === undefined
      ? []
      : [spec.expectedErrorCategory]),
    ...(spec.expectedErrorCategories ?? []),
  ];
  if (expectedCategories.length === 0) {
    return;
  }

  const actualCategory = classifyBlueLanguageError(error);
  if (
    actualCategory === undefined ||
    !expectedCategories.includes(actualCategory)
  ) {
    throw new Error(
      `Fixture ${spec.id} expected error category ${expectedCategories.join(
        ' or ',
      )}, got ${actualCategory ?? 'unclassified'} from ${formatThrownError(
        error,
      )}.`,
    );
  }
}

function classifyBlueLanguageError(
  error: unknown,
): FixtureBlueLanguageErrorCategory | undefined {
  const directCategory = blueLanguageErrorCategory(error);
  if (directCategory !== undefined) {
    return directCategory;
  }

  const code = errorCode(error);
  const text = formatThrownError(error).toLowerCase();

  if (
    code === 'BLUE_ID_MISMATCH' ||
    (text.includes('provider') &&
      text.includes('blueid') &&
      (text.includes('mismatch') || text.includes('returned content'))) ||
    text.includes('calculated blueid')
  ) {
    return 'ProviderBlueIdMismatch';
  }

  if (
    text.includes('duplicate preliminary') ||
    text.includes('circular') ||
    text.includes('cyclic')
  ) {
    return 'CircularSetError';
  }

  if (text.includes('$previous')) {
    return 'ListControlViolation';
  }

  if (
    text.includes('unresolved alias') ||
    text.includes('unresolved type alias') ||
    text.includes('invalid blueid input') ||
    text.includes('invalid blueid') ||
    text.includes('$pos') ||
    text.includes('$replace') ||
    text.includes('empty-object list element') ||
    text.includes('root null')
  ) {
    return 'InvalidBlueIdInput';
  }

  if (
    text.includes('applies to wrong kind') ||
    text.includes('multiple of') ||
    text.includes('multipleof') ||
    text.includes('minimum') ||
    text.includes('maxlength') ||
    text.includes('minlength')
  ) {
    return 'SchemaViolation';
  }

  if (
    text.includes('schema') &&
    (text.includes('vocabulary') ||
      text.includes('schema.required') ||
      text.includes('must be a list') ||
      text.includes('must be an array') ||
      text.includes('must be a boolean'))
  ) {
    return 'SchemaVocabularyError';
  }

  if (text.includes('schema')) {
    return 'SchemaViolation';
  }

  return undefined;
}

function errorCode(error: unknown): string | undefined {
  return isObject(error) && typeof error.code === 'string'
    ? error.code
    : undefined;
}

function formatThrownError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

function calculatePublishedRegistryBlueId(spec: LanguageFixtureSpec): string {
  const registryKey = requiredCoreRegistryKey(spec);
  const node = readRegistryNode(registryKey);
  const blueId = JavaBlueIdCalculator.calculateBlueIdSync(node);
  expect(blueId).toBe(CORE_TYPE_NAME_TO_BLUE_ID_MAP[registryKey]);

  if (spec.semanticDescriptionIdentityBearing === true) {
    expect(
      JavaBlueIdCalculator.calculateBlueIdSync(
        applyRegistryMutation(node, { field: 'description', append: ' ' }),
      ),
    ).not.toBe(blueId);
  }

  return blueId;
}

function changingRegistryDescriptionChangesBlueId(
  spec: LanguageFixtureSpec,
): boolean {
  const registryKey = requiredCoreRegistryKey(spec);
  const original = readRegistryNode(registryKey);
  const mutated = applyRegistryMutation(
    original,
    required(spec.mutation, 'mutation'),
  );
  return (
    JavaBlueIdCalculator.calculateBlueIdSync(original) !==
    JavaBlueIdCalculator.calculateBlueIdSync(mutated)
  );
}

function requiredCoreRegistryKey(spec: LanguageFixtureSpec): CoreRegistryKey {
  const registryKind = required(spec.registryKind, 'registryKind');
  if (registryKind !== 'Blue Language core type registry') {
    throw new Error(`Unsupported registry kind: ${registryKind}`);
  }

  const registryKey = required(spec.registryKey, 'registryKey');
  if (!isCoreRegistryKey(registryKey)) {
    throw new Error(`Unsupported core registry key: ${registryKey}`);
  }
  return registryKey;
}

type CoreRegistryKey = keyof typeof coreRegistryFiles;

function isCoreRegistryKey(value: string): value is CoreRegistryKey {
  return value in coreRegistryFiles;
}

function readRegistryNode(registryKey: CoreRegistryKey): BlueNode {
  return readYamlNodeFile(
    path.join(registryRoot, coreRegistryFiles[registryKey]),
  );
}

function applyRegistryMutation(
  node: BlueNode,
  mutation: RegistryMutation,
): BlueNode {
  const mutated = node.clone();
  switch (mutation.field) {
    case 'description':
      mutated.setDescription(
        `${mutated.getDescription() ?? ''}${mutation.append ?? ''}`,
      );
      return mutated;
    default:
      throw new Error(`Unsupported registry mutation field: ${mutation.field}`);
  }
}

function lintPublishableDocumentation(spec: LanguageFixtureSpec): void {
  const publishableFiles = required(spec.publishableFiles, 'publishableFiles');
  for (const publishableFile of publishableFiles) {
    const content = readPublishableFile(publishableFile);
    for (const heading of spec.requiredHeadings ?? []) {
      if (!content.includes(heading)) {
        throw new Error(
          `Publishable file ${publishableFile} is missing required heading: ${heading}`,
        );
      }
    }

    for (const term of spec.forbiddenJoinedTerms ?? []) {
      const forbiddenText = forbiddenJoinedText(term);
      if (content.includes(forbiddenText)) {
        throw new Error(
          `Publishable file ${publishableFile} contains forbidden text: ${forbiddenText}`,
        );
      }
    }
  }
}

function readPublishableFile(filePath: string): string {
  const resolvedPath = path.resolve(fixturePackageRoot, filePath);
  const relativePath = path.relative(fixturePackageRoot, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(
      `Publishable fixture path escapes fixture package: ${filePath}`,
    );
  }
  return fs.readFileSync(resolvedPath, 'utf8');
}

function resolveExistingDirectory(candidates: readonly string[]): string {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  throw new Error(
    `Blue Language conformance fixtures are missing. Checked: ${candidates.join(
      ', ',
    )}`,
  );
}

function forbiddenJoinedText(term: ForbiddenJoinedTerm): string {
  if (!Array.isArray(term.tokens) || typeof term.joiner !== 'string') {
    throw new Error('forbiddenJoinedTerms entries require tokens and joiner.');
  }
  return term.tokens.join(term.joiner);
}

function assertViewPath(spec: LanguageFixtureSpec): void {
  const root = serializeNode(readNode(required(spec.document, 'document')));
  const assertions = required(spec.assertions, 'assertions');
  for (const assertion of assertions) {
    const actual = readJsonPointer(root, assertion.path);
    let asserted = false;

    if (assertion.expectedRoot === true) {
      expect(actual).toEqual(root);
      asserted = true;
    }

    if (assertion.expectedNode !== undefined) {
      expect(actual).toEqual(
        serializeNode(
          readNode(required(assertion.expectedNode, 'expectedNode')),
        ),
      );
      asserted = true;
    }

    if (!asserted) {
      throw new Error(
        `View path assertion for ${assertion.path} has no expected value.`,
      );
    }
  }
}

function readJsonPointer(root: unknown, pointer: string): unknown {
  if (pointer === '') {
    return root;
  }
  if (!pointer.startsWith('/')) {
    throw new Error(`Invalid view path: ${pointer}`);
  }

  return pointer
    .slice(1)
    .split('/')
    .reduce<unknown>((current, rawSegment) => {
      const segment = decodeJsonPointerSegment(rawSegment);
      if (Array.isArray(current)) {
        if (!/^(0|[1-9]\d*)$/.test(segment)) {
          return undefined;
        }
        return current[Number(segment)];
      }
      if (isObject(current)) {
        return current[segment];
      }
      return undefined;
    }, root);
}

function decodeJsonPointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
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
  spec: LanguageFixtureSpec,
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

function readYamlNodeFile(filePath: string): BlueNode {
  return readNode(readYamlFile<unknown>(filePath));
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
