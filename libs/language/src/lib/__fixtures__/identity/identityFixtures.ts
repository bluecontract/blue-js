export type IdentityFixturePhase = 'phase-1' | 'phase-2' | 'phase-3';

export type IdentityFixtureInput =
  | {
      readonly kind: 'yaml';
      readonly value: string;
    }
  | {
      readonly kind: 'json';
      readonly value: unknown;
    };

export interface IdentityFixture {
  readonly name: string;
  readonly phase: IdentityFixturePhase;
  readonly description: string;
  readonly input: IdentityFixtureInput;
  readonly expectedEquivalentTo?: readonly string[];
  readonly expectedDistinctFrom?: readonly string[];
  readonly expectedInvalidForStorage?: boolean;
  readonly pathLimits?: readonly string[];
  readonly tags?: readonly string[];
}

export const identityFixtures = {
  scalarSugar: {
    name: 'scalarSugar',
    phase: 'phase-1',
    description: 'Authoring scalar sugar for wrapper equivalence.',
    input: {
      kind: 'yaml',
      value: `
x: 1
`,
    },
    expectedEquivalentTo: ['scalarWrapped'],
    tags: ['wrapper-equivalence', 'scalar'],
  },
  scalarWrapped: {
    name: 'scalarWrapped',
    phase: 'phase-1',
    description: 'Official wrapped scalar form.',
    input: {
      kind: 'yaml',
      value: `
x:
  value: 1
`,
    },
    expectedEquivalentTo: ['scalarSugar'],
    tags: ['wrapper-equivalence', 'scalar'],
  },
  listSugar: {
    name: 'listSugar',
    phase: 'phase-1',
    description: 'Authoring list sugar for wrapper equivalence.',
    input: {
      kind: 'yaml',
      value: `
x: [a, b]
`,
    },
    expectedEquivalentTo: ['listWrapped'],
    tags: ['wrapper-equivalence', 'list'],
  },
  listWrapped: {
    name: 'listWrapped',
    phase: 'phase-1',
    description: 'Official wrapped list form.',
    input: {
      kind: 'yaml',
      value: `
x:
  items: [a, b]
`,
    },
    expectedEquivalentTo: ['listSugar'],
    tags: ['wrapper-equivalence', 'list'],
  },
  pureRef: {
    name: 'pureRef',
    phase: 'phase-1',
    description: 'Exact pure reference shape that may short-circuit hashing.',
    input: {
      kind: 'json',
      value: {
        blueId: 'IdentityFixtureReferenceBlueId',
      },
    },
    expectedDistinctFrom: ['mixedBlueIdPayload'],
    tags: ['reference'],
  },
  materializedRefSubtree: {
    name: 'materializedRefSubtree',
    phase: 'phase-1',
    description:
      'Materialized subtree beside a reference; not an exact pure reference.',
    input: {
      kind: 'yaml',
      value: `
child:
  blueId: IdentityFixtureReferenceBlueId
  value: materialized
`,
    },
    tags: ['reference', 'materialized'],
  },
  mixedBlueIdPayload: {
    name: 'mixedBlueIdPayload',
    phase: 'phase-1',
    description:
      'Ambiguous authoring/storage input that combines blueId and payload.',
    input: {
      kind: 'yaml',
      value: `
name: Mixed BlueId Payload
x:
  blueId: IdentityFixtureReferenceBlueId
  value: 1
`,
    },
    expectedInvalidForStorage: true,
    expectedDistinctFrom: ['pureRef'],
    tags: ['reference', 'storage-validation'],
  },
  presentEmptyList: {
    name: 'presentEmptyList',
    phase: 'phase-1',
    description: 'Present-empty list; it is content and distinct from absent.',
    input: {
      kind: 'yaml',
      value: `
x: []
`,
    },
    expectedDistinctFrom: ['absentList'],
    tags: ['list', 'empty-list'],
  },
  absentList: {
    name: 'absentList',
    phase: 'phase-1',
    description: 'Missing list field used as contrast for present-empty list.',
    input: {
      kind: 'yaml',
      value: `
y: present
`,
    },
    expectedDistinctFrom: ['presentEmptyList'],
    tags: ['list', 'empty-list'],
  },
  appendOnlyList: {
    name: 'appendOnlyList',
    phase: 'phase-3',
    description: 'Spec-native append-only list using $previous.',
    input: {
      kind: 'yaml',
      value: `
entries:
  type: List
  mergePolicy: append-only
  items:
    - $previous:
        blueId: IdentityFixturePreviousListBlueId
    - C
`,
    },
    tags: ['list-controls', 'append-only'],
  },
  positionalList: {
    name: 'positionalList',
    phase: 'phase-3',
    description: 'Spec-native positional list overlay using $pos.',
    input: {
      kind: 'yaml',
      value: `
entries:
  type: List
  mergePolicy: positional
  items:
    - $pos: 1
      value: updated
    - appended
`,
    },
    tags: ['list-controls', 'positional'],
  },
  directCyclicTwoDocSet: {
    name: 'directCyclicTwoDocSet',
    phase: 'phase-3',
    description: 'Two-document direct cyclic set using this#k references.',
    input: {
      kind: 'yaml',
      value: `
- name: Identity Fixture Person
  pet:
    type:
      blueId: this#1

- name: Identity Fixture Dog
  owner:
    type:
      blueId: this#0
`,
    },
    tags: ['direct-cycle', 'this#k'],
  },
  resolvedInheritedTypeTree: {
    name: 'resolvedInheritedTypeTree',
    phase: 'phase-1',
    description:
      'Authoring source that resolves through a provider-backed inherited type.',
    input: {
      kind: 'yaml',
      value: `
name: Identity Fixture Child
type:
  blueId: <IdentityFixtureBaseTypeBlueId>
instanceOnly: child
`,
    },
    tags: ['resolved', 'type-inheritance'],
  },
  pathLimitedResolveVariant: {
    name: 'pathLimitedResolveVariant',
    phase: 'phase-1',
    description:
      'Same authoring source resolved with path limits; limits must not affect semantic BlueId.',
    input: {
      kind: 'yaml',
      value: `
name: Identity Fixture Child
type:
  blueId: <IdentityFixtureBaseTypeBlueId>
instanceOnly: child
`,
    },
    expectedEquivalentTo: ['resolvedInheritedTypeTree'],
    pathLimits: ['/instanceOnly'],
    tags: ['resolved', 'path-limits'],
  },
} as const satisfies Record<string, IdentityFixture>;

export type IdentityFixtureName = keyof typeof identityFixtures;

export const identityFixtureList = Object.values(identityFixtures);

export const getIdentityFixture = (
  name: IdentityFixtureName,
): IdentityFixture => identityFixtures[name];
