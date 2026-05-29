import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import yaml from 'js-yaml';
import {
  Blue,
  NodeProviderWrapper,
  createNodeProvider,
} from '@blue-labs/language';
import type { JsonValue } from '@blue-labs/shared-utils';
import { generateRepository } from '../lib/generateRepository';
import { lookupStorageContentByBlueId } from '../lib/core/blueIds';
import { PRIMITIVE_BLUE_IDS } from '../lib/core/constants';
import { createRepositoryGeneratorMergingProcessor } from '../lib/core/mergingProcessor';
import type { BluePackage, BlueTypeMetadata } from '../lib/types';

type JsonMap = Record<string, JsonValue>;

const BLUE_REPOSITORY = 'BlueRepository.blue';

const writeType = (
  repoRoot: string,
  pkg: string,
  file: string,
  contents: string,
) => {
  const dir = path.join(repoRoot, pkg);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), contents, 'utf8');
};

const createRepo = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'blue-repo-gen-'));

const readRepositoryFile = (repoRoot: string) =>
  fs.readFileSync(path.join(repoRoot, BLUE_REPOSITORY), 'utf8');

const persistRepository = (repoRoot: string, yaml: string) =>
  fs.writeFileSync(path.join(repoRoot, BLUE_REPOSITORY), yaml, 'utf8');

const createSemanticExpectedCalculator = () => {
  const contentByBlueId = new Map<string, JsonValue>();
  const parserBlue = new Blue();
  const provider = createNodeProvider((blueId) =>
    lookupStorageContentByBlueId(contentByBlueId, blueId).map((content) =>
      parserBlue.jsonValueToNode(content),
    ),
  );
  const blue = new Blue({
    nodeProvider: NodeProviderWrapper.unverified(provider),
    mergingProcessor: createRepositoryGeneratorMergingProcessor(),
  });

  return {
    calculate(content: JsonMap): string {
      const node = blue.jsonValueToNode(content);
      const blueId = blue.calculateBlueIdSync(node);
      const minimal = blue.minimize(blue.resolve(node));
      contentByBlueId.set(
        blueId,
        blue.nodeToJson(minimal, 'official') as JsonMap,
      );
      return blueId;
    },
  };
};

const LIST_YAML = `name: List
description: Ordered collection
`;

describe('generateRepository', () => {
  it('preserves indexed BlueId semantics in semantic lookup content', () => {
    const contentByBlueId = new Map<string, JsonValue>([
      ['list-id', [{ name: 'First' }, { name: 'Second' }]],
      ['single-id', { name: 'Only' }],
    ]);

    expect(lookupStorageContentByBlueId(contentByBlueId, 'list-id')).toEqual([
      { name: 'First' },
      { name: 'Second' },
    ]);
    expect(lookupStorageContentByBlueId(contentByBlueId, 'list-id#1')).toEqual([
      { name: 'Second' },
    ]);
    expect(lookupStorageContentByBlueId(contentByBlueId, 'list-id#99')).toEqual(
      [],
    );
    expect(
      lookupStorageContentByBlueId(contentByBlueId, 'list-id#bad'),
    ).toEqual([]);
    expect(
      lookupStorageContentByBlueId(contentByBlueId, 'single-id#0'),
    ).toEqual([{ name: 'Only' }]);
    expect(
      lookupStorageContentByBlueId(contentByBlueId, 'single-id#1'),
    ).toEqual([]);
  });

  it('generates initial repository with deterministic YAML', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'Name.blue',
      `name: Name
text:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Payments',
      'Price.blue',
      `name: Price
amount:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Orders',
      'Order.blue',
      `name: Order
id:
  type: Text
price:
  type: Payments/Price
`,
    );
    writeType(
      repoRoot,
      'Orders',
      'OrderDraft.dev.blue',
      `name: Order Draft
type: Orders/Order
`,
    );

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, result.yaml);

    expect(result.changed).toBe(true);
    expect(result.document.repositoryVersions).toHaveLength(1);
    expect(result.document.packages.map((p: BluePackage) => p.name)).toEqual([
      'Core',
      'Orders',
      'Payments',
    ]);
    expect(readRepositoryFile(repoRoot)).toEqual(result.yaml);
    expect(result.yaml).toMatchInlineSnapshot(`
      "name: Blue Repository
      packages:
        - name: Core
          types:
            - status: stable
              content:
                name: Name
                text:
                  type:
                    blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
              versions:
                - repositoryVersionIndex: 0
                  typeBlueId: Gpri2QifLTwoLHwWvUS2td1j6LdAopVGJhuzTSXgBzVn
                  attributesAdded: []
        - name: Orders
          types:
            - status: stable
              content:
                name: Order
                id:
                  type:
                    blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
                price:
                  type:
                    blueId: BYTxUuUHnyYFn2N142URWyDxviFWNwKwjRKwYrqNiifd
              versions:
                - repositoryVersionIndex: 0
                  typeBlueId: G73Cm3B1mjVxW3D3yk8zUPKfgdyXzTrHa8R31xxcp9uE
                  attributesAdded: []
            - status: dev
              content:
                name: Order Draft
                type:
                  blueId: G73Cm3B1mjVxW3D3yk8zUPKfgdyXzTrHa8R31xxcp9uE
              versions:
                - repositoryVersionIndex: 0
                  typeBlueId: E8ynGSKokxwgMiDRyF3fgDeAjGNcmcRXh4nVEeMb86cF
                  attributesAdded: []
        - name: Payments
          types:
            - status: stable
              content:
                name: Price
                amount:
                  type:
                    blueId: GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC
              versions:
                - repositoryVersionIndex: 0
                  typeBlueId: BYTxUuUHnyYFn2N142URWyDxviFWNwKwjRKwYrqNiifd
                  attributesAdded: []
      repositoryVersions:
        - GhDwwfRK1WKb6iBme31WUf4FECi6f83ni5MwnnRaPmtm
      "
    `);
  });

  it('canonicalizes legacy wrapped schema cardinality content before reuse', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'ListHolder.blue',
      `
name: List Holder
entries:
  type: List
  itemType: Text
  schema:
    minItems: 0
`,
    );
    writeType(
      repoRoot,
      'Core',
      'UsesHolder.blue',
      `
name: Uses Holder
holder:
  type: Core/List Holder
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });

    const legacyDocument = yaml.load(initial.yaml) as {
      packages: Array<{ name: string; types: Array<{ content: JsonMap }> }>;
    };
    const legacyListHolder = legacyDocument.packages
      .find((p) => p.name === 'Core')
      ?.types.find((t) => t.content.name === 'List Holder')?.content;
    if (!legacyListHolder) {
      throw new Error('Expected generated repository to contain List Holder.');
    }
    const legacyItems = legacyListHolder.entries as JsonMap;
    const legacySchema = legacyItems.schema as JsonMap;
    legacySchema.minItems = {
      type: { blueId: PRIMITIVE_BLUE_IDS.Integer },
      value: 0,
    };
    const legacyYaml = yaml.dump(legacyDocument);
    expect(legacyYaml).toContain(`blueId: ${PRIMITIVE_BLUE_IDS.Integer}`);
    persistRepository(repoRoot, legacyYaml);

    const regenerated = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });

    expect(regenerated.changed).toBe(true);
    const listHolder = regenerated.document.packages
      .find((p: BluePackage) => p.name === 'Core')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'List Holder',
      );
    const initialListHolder = initial.document.packages
      .find((p: BluePackage) => p.name === 'Core')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'List Holder',
      );

    expect(listHolder?.versions).toEqual(initialListHolder?.versions);
    expect(
      (
        (
          listHolder?.content as {
            entries?: { schema?: { minItems?: unknown } };
          }
        ).entries?.schema ?? {}
      ).minItems,
    ).toBe(0);
  });

  it('canonicalizes legacy runtime BlueIds before stable comparisons', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'RuntimeChannel.blue',
      `
name: Runtime Channel
type: Channel
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    const legacyDocument = yaml.load(initial.yaml) as {
      packages: Array<{ name: string; types: Array<{ content: JsonMap }> }>;
    };
    const legacyRuntimeChannel = legacyDocument.packages
      .find((p) => p.name === 'Core')
      ?.types.find((t) => t.content.name === 'Runtime Channel')?.content;
    if (!legacyRuntimeChannel) {
      throw new Error(
        'Expected generated repository to contain Runtime Channel.',
      );
    }
    legacyRuntimeChannel.type = {
      blueId: 'DcoJyCh7XXxy1nR5xjy7qfkUgQ1GiZnKKSxh8DJusBSr',
    };
    persistRepository(repoRoot, yaml.dump(legacyDocument));

    const regenerated = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });

    const runtimeChannel = regenerated.document.packages
      .find((p: BluePackage) => p.name === 'Core')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'Runtime Channel',
      );
    const initialRuntimeChannel = initial.document.packages
      .find((p: BluePackage) => p.name === 'Core')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'Runtime Channel',
      );

    expect(regenerated.changed).toBe(true);
    expect(runtimeChannel?.versions).toEqual(initialRuntimeChannel?.versions);
    expect(
      (runtimeChannel?.content as { type?: { blueId?: string } }).type?.blueId,
    ).toBe(PRIMITIVE_BLUE_IDS.Channel);
  });

  it('appends a version on non-breaking additions and bumps RepoBlueId', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'Thing.blue',
      `name: Thing
text:
  type: Text
`,
    );

    const first = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, first.yaml);
    expect(first.document.repositoryVersions).toHaveLength(1);

    writeType(
      repoRoot,
      'Core',
      'Thing.blue',
      `name: Thing
text:
  type: Text
optionalField:
  type: Text
  description: Optional
`,
    );

    const second = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });

    expect(second.document.repositoryVersions).toHaveLength(2);
    const typeMeta = second.document.packages
      .find((p: BluePackage) => p.name === 'Core')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'Thing',
      );
    expect(typeMeta?.versions).toHaveLength(2);
    expect(typeMeta?.versions.at(-1)?.attributesAdded).toEqual([
      '/optionalField',
    ]);
    expect(second.currentRepoBlueId).not.toEqual(first.currentRepoBlueId);
  });

  it('rejects optional additions that introduce fixed list payloads', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'Thing.blue',
      `
name: Thing
text:
  type: Text
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'Thing.blue',
      `
name: Thing
text:
  type: Text
optionalList:
  - foo
  - bar
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/Breaking change/);
  });

  it('allows enum constraints in newly-added optional fields', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'Thing.blue',
      `
name: Thing
text:
  type: Text
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'Thing.blue',
      `
name: Thing
text:
  type: Text
optionalEnum:
  type: Text
  schema:
    enum: [foo, bar]
`,
    );

    const updated = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(updated.document.repositoryVersions).toHaveLength(2);

    const typeMeta = updated.document.packages
      .find((p: BluePackage) => p.name === 'Core')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'Thing',
      );
    expect(typeMeta?.versions).toHaveLength(2);
    expect(typeMeta?.versions.at(-1)?.attributesAdded).toEqual([
      '/optionalEnum',
    ]);
  });

  it('allows adding fields inside inline list itemType definitions', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'ListItemTypeEvolution.blue',
      `
name: List Item Type Evolution
test:
  type: List
  itemType:
    test:
      type: Integer
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'ListItemTypeEvolution.blue',
      `
name: List Item Type Evolution
test:
  type: List
  itemType:
    test:
      type: Integer
    newProp:
      type: Text
`,
    );

    const updated = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(updated.document.repositoryVersions).toHaveLength(2);

    const typeMeta = updated.document.packages
      .find((p: BluePackage) => p.name === 'Core')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'List Item Type Evolution',
      );
    expect(typeMeta?.versions.at(-1)?.attributesAdded).toEqual([
      '/test/itemType/newProp',
    ]);
  });

  it('allows adding fields inside inline dictionary valueType definitions', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'DictionaryItemTypeEvolution.blue',
      `
name: Dictionary Item Type Evolution
test:
  type: Dictionary
  valueType:
    test:
      type: Integer
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'DictionaryItemTypeEvolution.blue',
      `
name: Dictionary Item Type Evolution
test:
  type: Dictionary
  valueType:
    test:
      type: Integer
    newProp:
      type: Text
`,
    );

    const updated = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(updated.document.repositoryVersions).toHaveLength(2);

    const typeMeta = updated.document.packages
      .find((p: BluePackage) => p.name === 'Core')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name ===
          'Dictionary Item Type Evolution',
      );
    expect(typeMeta?.versions.at(-1)?.attributesAdded).toEqual([
      '/test/valueType/newProp',
    ]);
  });

  it('rejects inline dictionary keyType definitions', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'DictionaryKeyTypeEvolution.blue',
      `
name: Dictionary Key Type Evolution
test:
  type: Dictionary
  keyType:
    test:
      type: Integer
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/Dictionary key type must be a basic type/);
  });

  it('allows adding schema on newly added optional fields', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'SchemaOnNewField.blue',
      `
name: Schema On New Field
field:
  type: Integer
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'SchemaOnNewField.blue',
      `
name: Schema On New Field
field:
  type: Integer
newField:
  type: Integer
  schema:
    minimum: 5
`,
    );

    const updated = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(updated.document.repositoryVersions).toHaveLength(2);

    const typeMeta = updated.document.packages
      .find((p: BluePackage) => p.name === 'Core')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'Schema On New Field',
      );
    expect(typeMeta?.versions.at(-1)?.attributesAdded).toEqual(['/newField']);
  });

  it('allows adding name and description to existing fields', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'FieldMetadataEvolution.blue',
      `
name: Field Metadata Evolution
field:
  type: Integer
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'FieldMetadataEvolution.blue',
      `
name: Field Metadata Evolution
field:
  type: Integer
  name: Field Name
  description: Field description
`,
    );

    const updated = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(updated.document.repositoryVersions).toHaveLength(2);

    const typeMeta = updated.document.packages
      .find((p: BluePackage) => p.name === 'Core')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'Field Metadata Evolution',
      );
    expect(typeMeta?.versions.at(-1)?.attributesAdded).toEqual([
      '/field/name',
      '/field/description',
    ]);
  });

  it('allows additions under inline type definitions', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'TypeSegmentEvolution.blue',
      `
name: Type Segment Evolution
test:
  type:
    field:
      type: Integer
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'TypeSegmentEvolution.blue',
      `
name: Type Segment Evolution
test:
  type:
    field:
      type: Integer
    newField:
      type: Boolean
`,
    );

    const updated = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(updated.document.repositoryVersions).toHaveLength(2);

    const typeMeta = updated.document.packages
      .find((p: BluePackage) => p.name === 'Core')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'Type Segment Evolution',
      );
    expect(typeMeta?.versions.at(-1)?.attributesAdded).toEqual([
      '/test/type/newField',
    ]);
  });

  it('stores dev BlueId in versions and overwrites on change', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Sandbox',
      'Base.blue',
      `
name: Base
text:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Sandbox',
      'Draft.dev.blue',
      `
name: Draft
text:
  type: Sandbox/Base
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);
    const draftMeta = initial.document.packages
      .find((p: BluePackage) => p.name === 'Sandbox')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'Draft',
      );
    expect(draftMeta?.versions).toHaveLength(1);
    const firstDevVersion = draftMeta?.versions[0];
    expect(firstDevVersion?.repositoryVersionIndex).toBe(0);

    writeType(
      repoRoot,
      'Sandbox',
      'Draft.dev.blue',
      `
name: Draft
text:
  type: Sandbox/Base
note:
  type: Text
`,
    );

    const updated = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    const updatedDraftMeta = updated.document.packages
      .find((p: BluePackage) => p.name === 'Sandbox')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'Draft',
      );
    expect(updatedDraftMeta?.versions).toHaveLength(1);
    const updatedVersion = updatedDraftMeta?.versions[0];
    expect(updatedVersion?.repositoryVersionIndex).toBe(1);
    expect(updatedVersion?.typeBlueId).not.toEqual(firstDevVersion?.typeBlueId);
    expect(updated.document.repositoryVersions).toHaveLength(2);
  });

  it('is idempotent when nothing changes (including dev types)', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Sandbox',
      'Base.blue',
      `
name: Base
text:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Sandbox',
      'Draft.dev.blue',
      `
name: Draft
text:
  type: Sandbox/Base
`,
    );

    const first = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, first.yaml);

    const second = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });

    expect(second.document.repositoryVersions).toHaveLength(
      first.document.repositoryVersions.length,
    );
    expect(second.yaml).toEqual(first.yaml);
  });

  it('preserves published BlueIds and stored content for unchanged existing types', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Sandbox',
      'Base.blue',
      `
name: Base
text:
  type: Text
description: Saved order
`,
    );

    const historicalTypeBlueId = '6CtkPkPVtmiQJJienGdzvZf2qGTRQntLXfh8PYeMfxBX';
    const historicalRepoBlueId = 'sUk1iHFrf7UQXAMeQvWRyvYVxxStUjfARaE5e4EgDKv';
    const previousYaml = yaml.dump(
      {
        name: 'Blue Repository',
        packages: [
          {
            name: 'Sandbox',
            types: [
              {
                status: 'stable',
                content: {
                  name: 'Base',
                  description: 'Saved order',
                  text: {
                    type: {
                      blueId: PRIMITIVE_BLUE_IDS.Text,
                    },
                  },
                },
                versions: [
                  {
                    repositoryVersionIndex: 0,
                    typeBlueId: historicalTypeBlueId,
                    attributesAdded: [],
                  },
                ],
              },
            ],
          },
        ],
        repositoryVersions: [historicalRepoBlueId],
      },
      { lineWidth: -1 },
    );
    persistRepository(repoRoot, previousYaml);

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    const typeMetadata = result.document.packages[0]?.types[0];

    expect(result.changed).toBe(false);
    expect(result.currentRepoBlueId).toBe(historicalRepoBlueId);
    expect(result.yaml).toEqual(readRepositoryFile(repoRoot));
    expect(typeMetadata?.versions[0]?.typeBlueId).toBe(historicalTypeBlueId);
    expect(Object.keys(typeMetadata?.content ?? {})).toEqual([
      'name',
      'description',
      'text',
    ]);
  });

  it('rejects breaking changes to stable types', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'Foo.blue',
      `
name: Foo
text:
  type: Text
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'Foo.blue',
      `
name: Foo
text:
  type: Integer
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/Breaking change/);
  });

  it('rejects breaking changes when field type changes', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'TypeBreakingChange.blue',
      `
name: Type Breaking Change
test:
  type: Text
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'TypeBreakingChange.blue',
      `
name: Type Breaking Change
test:
  type: Integer
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/Breaking change/);
  });

  it('rejects breaking changes when referenced type changes', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'TypeA.blue',
      `
name: Type A
text:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Core',
      'TypeB.blue',
      `
name: Type B
text:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Core',
      'RefType.blue',
      `
name: Reference Type
ref:
  type: Core/Type A
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'RefType.blue',
      `
name: Reference Type
ref:
  type: Core/Type B
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/Breaking change/);
  });

  it('rejects breaking changes when nested field shape changes', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'NestedTypeBreakingChange.blue',
      `
name: Nested Type Breaking Change
test:
  nested:
    type: Boolean
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'NestedTypeBreakingChange.blue',
      `
name: Nested Type Breaking Change
test:
  nested:
    moreNested:
      type: Boolean
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/Breaking change/);
  });

  it('rejects breaking changes when switching to a literal value', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'ValueTypeBreakingChange.blue',
      `
name: Value Type Breaking Change
test:
  type: Text
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'ValueTypeBreakingChange.blue',
      `
name: Value Type Breaking Change
test: Specific text
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/Breaking change/);
  });

  it('rejects breaking changes when literal values change', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'ValueBreakingChange.blue',
      `
name: Value Breaking Change
test: Test 1
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'ValueBreakingChange.blue',
      `
name: Value Breaking Change
test: Test 2
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/Breaking change/);
  });

  it('rejects breaking changes when dictionary value type changes', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'DictionaryTypeBreakingChange.blue',
      `
name: Dictionary Type Breaking Change
test:
  type: Dictionary
  valueType: Integer
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'DictionaryTypeBreakingChange.blue',
      `
name: Dictionary Type Breaking Change
test:
  type: Dictionary
  valueType: Text
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/Breaking change/);
  });

  it('rejects breaking changes when adding schema to existing fields', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'SchemaTypeBreakingChange.blue',
      `
name: Schema Type Breaking Change
test:
  type: Integer
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'SchemaTypeBreakingChange.blue',
      `
name: Schema Type Breaking Change
test:
  type: Integer
  schema:
    minimum: 0
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/Breaking change/);
  });

  it('rejects breaking changes when root type changes', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'Test.blue',
      `
name: Test
text:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Core',
      'RootTypeBreakingChange.blue',
      `
name: Root Type Breaking Change
type: Core/Test
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'RootTypeBreakingChange.blue',
      `
name: Root Type Breaking Change
type: Integer
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/Breaking change/);
  });

  it('rejects breaking changes when root type is introduced', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'RootTypeBreakingChange.blue',
      `
name: Root Type Breaking Change
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);

    writeType(
      repoRoot,
      'Core',
      'RootTypeBreakingChange.blue',
      `
name: Root Type Breaking Change
type: Integer
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/Breaking change/);
  });

  it('allows dropping dev types but forbids dropping stable types', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'Stable.blue',
      `
name: Stable
text:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Core',
      'Scratch.dev.blue',
      `
name: Scratch
type: Text
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(initial.changed).toBe(true);
    persistRepository(repoRoot, initial.yaml);

    fs.rmSync(path.join(repoRoot, 'Core', 'Scratch.dev.blue'));
    const withoutDev = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    expect(withoutDev.changed).toBe(true);

    fs.rmSync(path.join(repoRoot, 'Core', 'Stable.blue'));
    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/removed/);
  });

  it('rejects stable types that depend on dev types', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Experiments',
      'Feature.dev.blue',
      `
name: Feature
flag:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Core',
      'UsesFeature.blue',
      `
name: Uses Feature
feature:
  type: Experiments/Feature
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/depends on a dev type/);
  });

  it('supports circular dependencies with combined BlueIds', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'A.blue',
      `
name: A
ref:
  type: Core/B
`,
    );
    writeType(
      repoRoot,
      'Core',
      'B.blue',
      `
name: B
ref:
  type: Core/A
`,
    );

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });

    const coreTypes =
      result.document.packages.find((pkg) => pkg.name === 'Core')?.types ?? [];
    const a = coreTypes.find(
      (type) => (type.content as { name?: string }).name === 'A',
    );
    const b = coreTypes.find(
      (type) => (type.content as { name?: string }).name === 'B',
    );
    const aBlueId = a?.versions.at(-1)?.typeBlueId;
    const bBlueId = b?.versions.at(-1)?.typeBlueId;

    if (!a || !b) {
      throw new Error('Expected cyclic test types to be generated.');
    }

    expect(aBlueId).toBeDefined();
    expect(bBlueId).toBeDefined();
    expect(aBlueId).not.toEqual(bBlueId);

    const [masterBlueIdA, aSuffix] = (aBlueId ?? '').split('#');
    const [masterBlueIdB, bSuffix] = (bBlueId ?? '').split('#');
    expect(masterBlueIdA).toEqual(masterBlueIdB);
    expect(new Set([aSuffix, bSuffix])).toEqual(new Set(['0', '1']));

    const aReference = (a?.content as { ref?: { type?: { blueId?: string } } })
      .ref?.type?.blueId;
    const bReference = (b?.content as { ref?: { type?: { blueId?: string } } })
      .ref?.type?.blueId;
    expect(aReference).toEqual(`this#${bSuffix}`);
    expect(bReference).toEqual(`this#${aSuffix}`);

    const sortedContent = [
      { suffix: aSuffix, content: a.content },
      { suffix: bSuffix, content: b.content },
    ]
      .sort((left, right) =>
        String(left.suffix).localeCompare(String(right.suffix)),
      )
      .map((entry) => entry.content);

    expect(new Blue().calculateBlueIdSync(sortedContent)).toEqual(
      masterBlueIdA,
    );
  });

  it('supports single-type self references', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'Node.blue',
      `
name: Node
next:
  type: Core/Node
`,
    );

    const expectedMasterBlueId = new Blue().calculateBlueIdSync([
      {
        name: 'Node',
        next: {
          type: {
            blueId: 'this#0',
          },
        },
      },
    ]);

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    const node = result.document.packages
      .find((pkg) => pkg.name === 'Core')
      ?.types.find(
        (type) => (type.content as { name?: string }).name === 'Node',
      );

    expect(node?.versions.at(-1)?.typeBlueId).toEqual(
      `${expectedMasterBlueId}#0`,
    );
    expect(
      (node?.content as { next?: { type?: { blueId?: string } } }).next?.type
        ?.blueId,
    ).toEqual('this#0');
  });

  it('rejects reserved value as an attribute declaration', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'Bad.blue',
      `
name: Bad
value:
  type: Text
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/Can't handle node/);
  });

  it('rejects document-level properties in source type files', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'BadProperties.blue',
      `
name: Bad Properties
properties:
  text:
    type: Text
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/properties is an internal field/);
  });

  it('accepts typed scalar value payloads', () => {
    const primitiveIds = PRIMITIVE_BLUE_IDS;
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'ScalarValue.blue',
      `
name: Scalar Value
status:
  type: Text
  value: draft
`,
    );

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    const meta = result.document.packages
      .find((p: BluePackage) => p.name === 'Core')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'Scalar Value',
      );

    expect(meta?.content).toEqual({
      name: 'Scalar Value',
      status: {
        type: { blueId: primitiveIds.Text },
        value: 'draft',
      },
    });
  });

  it('accepts built-in runtime aliases without package qualification', () => {
    const primitiveIds = PRIMITIVE_BLUE_IDS;
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Contracts',
      'TimelineChannel.blue',
      `
name: Timeline Channel
type: Channel
event:
  type: Document Update
`,
    );

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    const meta = result.document.packages
      .find((p: BluePackage) => p.name === 'Contracts')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'Timeline Channel',
      );

    expect(meta?.content).toEqual({
      name: 'Timeline Channel',
      type: { blueId: primitiveIds.Channel },
      event: {
        type: { blueId: primitiveIds['Document Update'] },
      },
    });
  });

  it('substitutes type/keyType/valueType with BlueIds when computing hashes', () => {
    const repoRoot = createRepo();
    const primitiveIds = PRIMITIVE_BLUE_IDS;
    writeType(
      repoRoot,
      'Core',
      'Text.blue',
      `
name: Text
description: primitive text
`,
    );
    writeType(
      repoRoot,
      'Core',
      'Dictionary.blue',
      `
name: Dictionary
description: dictionary primitive
keyType:
  description: key type
valueType:
  description: value type
`,
    );
    writeType(
      repoRoot,
      'Conversation',
      'Message.blue',
      `
name: Message
body:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Conversation',
      'MapHolder.blue',
      `
name: Map Holder
map:
  type: Dictionary
  keyType: Text
  valueType: Conversation/Message
`,
    );

    const textBlueId = primitiveIds.Text;
    const dictionaryBlueId = primitiveIds.Dictionary;
    const semantic = createSemanticExpectedCalculator();
    const expectedMessageBlueId = semantic.calculate({
      name: 'Message',
      body: { type: { blueId: textBlueId } },
    });
    const expectedMapHolderBlueId = semantic.calculate({
      name: 'Map Holder',
      map: {
        type: { blueId: dictionaryBlueId },
        keyType: { blueId: textBlueId },
        valueType: { blueId: expectedMessageBlueId },
      },
    });

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });

    const conversationPkg = result.document.packages.find(
      (p: BluePackage) => p.name === 'Conversation',
    );
    const messageMeta = conversationPkg?.types.find(
      (t: BlueTypeMetadata) =>
        (t.content as { name?: string }).name === 'Message',
    );
    const mapHolderMeta = conversationPkg?.types.find(
      (t: BlueTypeMetadata) =>
        (t.content as { name?: string }).name === 'Map Holder',
    );

    expect(messageMeta?.versions.at(-1)?.typeBlueId).toEqual(
      expectedMessageBlueId,
    );
    expect(mapHolderMeta?.versions.at(-1)?.typeBlueId).toEqual(
      expectedMapHolderBlueId,
    );
  });

  it('computes generated typeBlueId through semantic Blue', () => {
    const primitiveIds = PRIMITIVE_BLUE_IDS;
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'SemanticType.blue',
      `
name: Semantic Type
label:
  type: Text
`,
    );

    const expectedBlueId = createSemanticExpectedCalculator().calculate({
      name: 'Semantic Type',
      label: { type: { blueId: primitiveIds.Text } },
    });

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    const meta = result.document.packages
      .find((p: BluePackage) => p.name === 'Core')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'Semantic Type',
      );

    expect(meta?.versions.at(-1)?.typeBlueId).toEqual(expectedBlueId);
  });

  it('computes the canonical BlueId for List using hardcoded primitives', () => {
    const primitiveIds = PRIMITIVE_BLUE_IDS;

    const repoRoot = createRepo();
    writeType(repoRoot, 'Core', 'List.blue', LIST_YAML);

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });

    const listMeta = result.document.packages
      .find((p: BluePackage) => p.name === 'Core')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'List',
      );

    expect(listMeta?.versions.at(-1)?.typeBlueId).toEqual(primitiveIds.List);
  });

  it('wraps literal fields with inferred primitive types when hashing', () => {
    const primitiveIds = PRIMITIVE_BLUE_IDS;

    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Conversation',
      'StatusLiteral.blue',
      `
name: Status Literal
mode: terminated
flag: true
count: 3
score: 1.5
`,
    );

    const expectedContent = {
      name: 'Status Literal',
      mode: { type: { blueId: primitiveIds.Text }, value: 'terminated' },
      flag: { type: { blueId: primitiveIds.Boolean }, value: true },
      count: { type: { blueId: primitiveIds.Integer }, value: 3 },
      score: { type: { blueId: primitiveIds.Double }, value: 1.5 },
    };
    const expectedBlueId =
      createSemanticExpectedCalculator().calculate(expectedContent);

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });

    const meta = result.document.packages
      .find((p: BluePackage) => p.name === 'Conversation')
      ?.types.find(
        (t: BlueTypeMetadata) =>
          (t.content as { name?: string }).name === 'Status Literal',
      );

    expect(meta?.versions.at(-1)?.typeBlueId).toEqual(expectedBlueId);
    expect(meta?.content).toEqual(expectedContent);
  });

  it('preserves expression values without conflicting with inherited list fields', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'JsonPatchEntry.blue',
      `
name: Json Patch Entry
op:
  type: Text
path:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Conversation',
      'UpdateDocument.blue',
      `
name: Update Document
changeset:
  type: List
  itemType: Core/Json Patch Entry
`,
    );
    writeType(
      repoRoot,
      'Conversation',
      'ApplyStep.blue',
      `
name: Apply Step
type: Conversation/Update Document
changeset: '\${steps.Prepare.changeset}'
`,
    );

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });

    const conversationPkg = result.document.packages.find(
      (p: BluePackage) => p.name === 'Conversation',
    );
    const applyStep = conversationPkg?.types.find(
      (t: BlueTypeMetadata) =>
        (t.content as { name?: string }).name === 'Apply Step',
    );
    const applyStepContent = applyStep?.content as JsonMap | undefined;

    expect(applyStep?.versions.at(-1)?.typeBlueId).toBeDefined();
    expect(applyStepContent?.changeset).toEqual({
      $steps: 'Prepare.changeset',
    });
  });
});
