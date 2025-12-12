import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BlueIdCalculator } from '@blue-labs/language';
import { generateRepository } from '../lib/generateRepository';

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

const LIST_YAML = `name: List
description: Ordered collection
itemType:
  description: Optional item type
mergePolicy:
  type: Text
  schema:
    enum: [append-only, positional]
`;

describe('generateRepository', () => {
  it('generates initial repository with deterministic YAML', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'Name.blue',
      `name: Name
value:
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
    expect(result.document.packages.map((p) => p.name)).toEqual([
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
                value:
                  type:
                    blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
              versions:
                - repositoryVersionIndex: 0
                  typeBlueId: FbHormNCd1j6RLU6DD4NmXaUvsmaQbAorpMJmYpPVYQM
                  attributesAdded: []
        - name: Orders
          types:
            - status: stable
              content:
                name: Order
                id:
                  type:
                    blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
                price:
                  type:
                    blueId: 8ofNzdVUfLafwPZCHMS4sXUJYQhpW9EXv2ezNrBDmpds
              versions:
                - repositoryVersionIndex: 0
                  typeBlueId: 53Nr6BT9GfdbE4Peyu8rJddEzRFuNDh5NzbszbMFRqQd
                  attributesAdded: []
            - status: dev
              content:
                name: Order Draft
                type:
                  blueId: 53Nr6BT9GfdbE4Peyu8rJddEzRFuNDh5NzbszbMFRqQd
              versions:
                - repositoryVersionIndex: 0
                  typeBlueId: CiXDJa7RAr9RyFeBS98wZmRAHT1Mhc83rx3J7NU3eJ6e
                  attributesAdded: []
        - name: Payments
          types:
            - status: stable
              content:
                name: Price
                amount:
                  type:
                    blueId: DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K
              versions:
                - repositoryVersionIndex: 0
                  typeBlueId: 8ofNzdVUfLafwPZCHMS4sXUJYQhpW9EXv2ezNrBDmpds
                  attributesAdded: []
      repositoryVersions:
        - nPF5MjY3wePXzHkQ6aBFMJ2ky7iizT28V1SGnBBbJog
      "
    `);
  });

  it('appends a version on non-breaking additions and bumps RepoBlueId', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'Thing.blue',
      `name: Thing
value:
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
value:
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
      .find((p) => p.name === 'Core')
      ?.types.find((t) => (t.content as { name?: string }).name === 'Thing');
    expect(typeMeta?.versions).toHaveLength(2);
    expect(typeMeta?.versions.at(-1)?.attributesAdded).toEqual([
      '/optionalField',
    ]);
    expect(second.currentRepoBlueId).not.toEqual(first.currentRepoBlueId);
  });

  it('stores dev BlueId in versions and overwrites on change', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Sandbox',
      'Base.blue',
      `name: Base
value:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Sandbox',
      'Draft.dev.blue',
      `name: Draft
value:
  type: Sandbox/Base
`,
    );

    const initial = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });
    persistRepository(repoRoot, initial.yaml);
    const draftMeta = initial.document.packages
      .find((p) => p.name === 'Sandbox')
      ?.types.find((t) => (t.content as { name?: string }).name === 'Draft');
    expect(draftMeta?.versions).toHaveLength(1);
    const firstDevVersion = draftMeta?.versions[0];
    expect(firstDevVersion?.repositoryVersionIndex).toBe(0);

    writeType(
      repoRoot,
      'Sandbox',
      'Draft.dev.blue',
      `name: Draft
value:
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
      .find((p) => p.name === 'Sandbox')
      ?.types.find((t) => (t.content as { name?: string }).name === 'Draft');
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
      `name: Base
value:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Sandbox',
      'Draft.dev.blue',
      `name: Draft
value:
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

  it('rejects breaking changes to stable types', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'Foo.blue',
      `name: Foo
value:
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
      `name: Foo
value:
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
      `name: Stable
value:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Core',
      'Scratch.dev.blue',
      `name: Scratch
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
      `name: Feature
flag:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Core',
      'UsesFeature.blue',
      `name: Uses Feature
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

  it('detects circular dependencies', () => {
    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Core',
      'A.blue',
      `name: A
ref:
  type: Core/B
`,
    );
    writeType(
      repoRoot,
      'Core',
      'B.blue',
      `name: B
ref:
  type: Core/A
`,
    );

    expect(() =>
      generateRepository({
        repoRoot,
        blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
      }),
    ).toThrow(/Circular type dependency/);
  });

  it('substitutes type/keyType/valueType with BlueIds when computing hashes', () => {
    const repoRoot = createRepo();
    const primitiveIds = {
      Text: 'DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K',
      Dictionary: 'G7fBT9PSod1RfHLHkpafAGBDVAJMrMhAMY51ERcyXNrj',
      List: '6aehfNAxHLC1PHHoDr3tYtFH3RWNbiWdFancJ1bypXEY',
    };
    writeType(
      repoRoot,
      'Core',
      'Text.blue',
      `name: Text
description: primitive text
`,
    );
    writeType(
      repoRoot,
      'Core',
      'Dictionary.blue',
      `name: Dictionary
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
      `name: Message
body:
  type: Text
`,
    );
    writeType(
      repoRoot,
      'Conversation',
      'MapHolder.blue',
      `name: Map Holder
map:
  type: Dictionary
  keyType: Text
  valueType: Conversation/Message
`,
    );

    const textBlueId = primitiveIds.Text;
    const dictionaryBlueId = primitiveIds.Dictionary;
    const expectedMessageBlueId = BlueIdCalculator.INSTANCE.calculateSync({
      name: 'Message',
      body: { type: { blueId: textBlueId } },
    });
    const expectedMapHolderBlueId = BlueIdCalculator.INSTANCE.calculateSync({
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
      (p) => p.name === 'Conversation',
    );
    const messageMeta = conversationPkg?.types.find(
      (t) => (t.content as { name?: string }).name === 'Message',
    );
    const mapHolderMeta = conversationPkg?.types.find(
      (t) => (t.content as { name?: string }).name === 'Map Holder',
    );

    expect(messageMeta?.versions.at(-1)?.typeBlueId).toEqual(
      expectedMessageBlueId,
    );
    expect(mapHolderMeta?.versions.at(-1)?.typeBlueId).toEqual(
      expectedMapHolderBlueId,
    );
  });

  it('computes the canonical BlueId for List using hardcoded primitives', () => {
    const primitiveIds = {
      List: '6aehfNAxHLC1PHHoDr3tYtFH3RWNbiWdFancJ1bypXEY',
    } as const;

    const repoRoot = createRepo();
    writeType(repoRoot, 'Core', 'List.blue', LIST_YAML);

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });

    const listMeta = result.document.packages
      .find((p) => p.name === 'Core')
      ?.types.find((t) => (t.content as { name?: string }).name === 'List');

    expect(listMeta?.versions.at(-1)?.typeBlueId).toEqual(primitiveIds.List);
  });

  it('wraps literal fields with inferred primitive types when hashing', () => {
    const primitiveIds = {
      Text: 'DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K',
      Boolean: '4EzhSubEimSQD3zrYHRtobfPPWntUuhEz8YcdxHsi12u',
      Integer: '5WNMiV9Knz63B4dVY5JtMyh3FB4FSGqv7ceScvuapdE1',
      Double: '7pwXmXYCJtWnd348c2JQGBkm9C4renmZRwxbfaypsx5y',
    } as const;

    const repoRoot = createRepo();
    writeType(
      repoRoot,
      'Conversation',
      'StatusLiteral.blue',
      `name: Status Literal
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
      BlueIdCalculator.INSTANCE.calculateSync(expectedContent);

    const result = generateRepository({
      repoRoot,
      blueRepositoryPath: path.join(repoRoot, BLUE_REPOSITORY),
    });

    const meta = result.document.packages
      .find((p) => p.name === 'Conversation')
      ?.types.find(
        (t) => (t.content as { name?: string }).name === 'Status Literal',
      );

    expect(meta?.versions.at(-1)?.typeBlueId).toEqual(expectedBlueId);
    expect(meta?.content).toEqual(expectedContent);
  });
});
