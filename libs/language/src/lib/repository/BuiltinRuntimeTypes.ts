import type { JsonValue } from '@blue-labs/shared-utils';
import type { BlueRepository } from '../types/BlueRepository';

export const BUILTIN_RUNTIME_TYPE_CONTENT_BY_BLUE_ID = {
  '6WrVQoSpKHUUg5HPrwjkVV6pxe4sdkyGnakMs8ayEGeF': {
    name: 'Contract',
    description:
      "Base Blue Contracts and Processor 1.0 runtime type for executable or processor-interpreted declarations under an active scope's contracts map. A Contract is scope-local, identity-bearing Blue content. The processor discovers materialized contract entries in the selected document, resolves each entry far enough to identify its effective runtime type BlueId, and either executes supported behavior or applies must-understand and fatal rules. Contract entries are sorted by effective order and contract-map key when ordering is required. A Contract by itself has no executable behavior; concrete subtypes define Channel, Handler, Marker, or extension semantics.\n",
    order: {
      type: { blueId: 'E2LM6qgzWG9ttagq2xTmiZkgYEAgkYedFCmU9v7NnVEq' },
      description:
        'Optional deterministic sort key within a scope. Missing order is treated as 0. Ordering compares order first, ascending, then contract-map key in lexicographic Unicode code-point order.\n',
    },
  },
  '61W96XosAp3DrEC7PuqLYtmF2A6ETpqH6qF2DgYwDq4c': {
    name: 'Json Patch Entry',
    description:
      "Blue Contracts and Processor 1.0 runtime patch request produced by handlers. A Json Patch Entry describes one deterministic mutation request against the selected document. Only add, replace, and remove are supported. The path is a Blue Runtime Pointer and must not target the document root. Despite its historical name, Json Patch Entry is not full RFC 6902; it uses Blue-specific upsert, auto-materialization, runtime insertion normalization, and post-patch type-soundness rules. The val field is required for add and replace and must be absent for remove. Patches are applied in result order; each successful patch triggers its full Document Update cascade before the next patch is applied. Field is named val, not value, because value is Blue's scalar payload wrapper.\n",
    op: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description:
        'Required patch operation. Allowed values are add, replace, and remove.\n',
      schema: { required: true, enum: ['add', 'replace', 'remove'] },
    },
    path: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description:
        'Required absolute Blue Runtime Pointer identifying the mutation target. The empty string is invalid. The root pointer / is not a valid runtime patch target for handlers or channels.\n',
      schema: { required: true },
    },
    val: {
      description:
        'Patch payload for add and replace. It may be any valid Blue node. It must be absent for remove.\n',
    },
  },
  AMtAXPmvumgz1GxKUU9uv3ncXiKMENvqq8AaLvD5LXhv: {
    name: 'Contract Execution Result',
    description:
      'Abstract processor result shape used to normalize effects returned by a supported handler or by a supported channel type that explicitly permits channel results. In Blue Contracts 1.0 core, patches and Triggered emissions are handler effects. External channels must not return patches or Triggered events unless a supported extension explicitly grants that capability. When a result is applied, the processor applies explicit gas first, then patches in order with immediate cascades, then emitted events in order, then a requested termination. Invalid present result fields cause runtime fatal termination before any effects from that result are applied, except for overhead already charged.\n',
    patches: {
      type: { blueId: '8DSFoWG9MqRSUhStqoPLrwVQiYByRh18NWbDEarN8MKF' },
      itemType: {
        type: { blueId: '61W96XosAp3DrEC7PuqLYtmF2A6ETpqH6qF2DgYwDq4c' },
      },
      description:
        'Optional list of patch entries. Missing is equivalent to an empty list. Patches are applied in list order. Each successful patch triggers its Document Update cascade before the next patch.\n',
    },
    triggeredEvents: {
      type: { blueId: '8DSFoWG9MqRSUhStqoPLrwVQiYByRh18NWbDEarN8MKF' },
      description:
        'Optional list of Blue event nodes to record and enqueue as Triggered events after all patches from the same result are applied. Missing is equivalent to an empty list.\n',
    },
    gasConsumed: {
      type: { blueId: 'E2LM6qgzWG9ttagq2xTmiZkgYEAgkYedFCmU9v7NnVEq' },
      description:
        'Optional non-negative explicit gas consumed by the contract. Missing is equivalent to 0. Negative gas is invalid and causes runtime fatal termination.\n',
    },
    termination: {
      description:
        'Optional termination request. If present, it requests graceful or fatal termination after gas, patches, and emitted events from the same result have been processed in the required order.\n',
    },
  },
  '4FAZ94JPExNM4pn2ZhtdHa4CVP7uASmLNVrBy7aCG1p5': {
    name: 'Channel',
    type: { blueId: '6WrVQoSpKHUUg5HPrwjkVV6pxe4sdkyGnakMs8ayEGeF' },
    description:
      'Runtime contract role for event entry points within a scope. A Channel evaluates an incoming event or processor-managed delivery and either rejects it or accepts it by producing one channelized payload for same-scope handlers bound to that channel key. A Channel may consume gas and may request termination only through processor-defined interfaces. A Channel must not directly mutate the selected document. Processor-managed channel subtypes are fed only by the processor and are never directly entered by external events.\n',
    event: {
      description:
        'Optional channel-specific matcher or matcher configuration. The meaning is defined by the concrete channel type.\n',
    },
  },
  '7X46P3Q6FJrogqKrBXTALpqzkieyyiQeatnqLvWzAPXE': {
    name: 'Handler',
    type: { blueId: '6WrVQoSpKHUUg5HPrwjkVV6pxe4sdkyGnakMs8ayEGeF' },
    description:
      'Runtime contract role for deterministic logic bound to exactly one channel in the same scope. A Handler is eligible only for deliveries produced by the same-scope channel named by its channel field. A Handler may request patches, emit Blue event nodes, consume non-negative gas, or request termination. It has no other permitted observable side effects. For a given document snapshot, channelized payload, handler contract content, and allowed context, a Handler must produce deterministic results.\n',
    channel: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description:
        'Required same-scope contract-map key of the channel this handler binds to. Handlers do not bind to channels in parent, child, embedded, or referenced nodes.\n',
      schema: { required: true },
    },
    event: {
      description:
        'Optional handler-specific matcher for the channelized payload. The meaning is defined by the concrete handler type or extension runtime.\n',
    },
  },
  '6zqbYGDGrMv5ReuEsjyzyyjjuqVnqDZxtY7RsPXdBTNy': {
    name: 'Marker',
    type: { blueId: '6WrVQoSpKHUUg5HPrwjkVV6pxe4sdkyGnakMs8ayEGeF' },
    description:
      'Runtime contract role for processor-observed state or policy. Markers do not run contract logic. The processor obeys supported marker semantics when a supported marker appears at the correct reserved key. Unsupported marker types in an active scope are subject to must-understand rules. Required processor-managed markers have reserved keys under contracts and must not appear under other keys.\n',
  },
  '8FVc8MPz6DcTMgcY3RXU6EBpGa9arWPJ141K2H86yi8Q': {
    name: 'Process Embedded',
    type: { blueId: '6zqbYGDGrMv5ReuEsjyzyyjjuqVnqDZxtY7RsPXdBTNy' },
    description:
      'Required processor-managed marker at contracts/embedded. It declares embedded child scopes beneath the current scope. The processor reads paths dynamically during embedded traversal, re-reads after each processed child, processes each normalized child path at most once per parent invocation, and rejects malformed, duplicate, self-root, or non-object embedded scope paths according to the processor rules. Missing child paths are skipped and marked processed for the current invocation.\n',
    paths: {
      type: { blueId: '8DSFoWG9MqRSUhStqoPLrwVQiYByRh18NWbDEarN8MKF' },
      itemType: {
        type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      },
      description:
        "Required list of scope-relative Blue Runtime Pointers identifying embedded child roots. Each path must begin with /, must not be /, and must resolve inside the current scope's pointer domain. Duplicate resolved child paths are invalid.\n",
      schema: { required: true, uniqueItems: true },
    },
  },
  '6JjyUKoK7uJxA5NY9YhMaKJbXC6c9iHyx1khv4gaAq4Q': {
    name: 'Processing Initialized Marker',
    type: { blueId: '6zqbYGDGrMv5ReuEsjyzyyjjuqVnqDZxtY7RsPXdBTNy' },
    description:
      'Required processor-managed marker at contracts/initialized. It records that a scope has completed first-run initialization. The processor publishes the Document Processing Initiated lifecycle event before writing this marker. The marker is written by a processor-managed patch that triggers the normal Document Update cascade. The marker stores the pre-initialization Content BlueId of the scope subtree as documentId.\n',
    documentId: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description:
        'Required BlueId string for the pre-initialization Content BlueId of the scope subtree. The value must be a valid Blue Language BlueId string.\n',
      schema: { required: true },
    },
  },
  GBDBthfshBFr4GQKUU1fmy4GnPL7q2y3as4deUWpuBtu: {
    name: 'Processing Terminated Marker',
    type: { blueId: '6zqbYGDGrMv5ReuEsjyzyyjjuqVnqDZxtY7RsPXdBTNy' },
    description:
      'Required processor-managed marker at contracts/terminated. It records final runtime state for a scope. A scope with a valid pre-existing terminated marker is inactive for processing: it incurs scope-entry gas when entered, but it is not initialized, matched, bridged, drained, checkpointed, or run. Termination markers are written by processor Direct Write and do not emit Document Update cascades. An ancestor may replace or remove an embedded child root containing this marker as a whole.\n',
    cause: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description:
        'Required termination cause. fatal means deterministic runtime fatal termination. graceful means contract-requested non-error termination.\n',
      schema: { required: true, enum: ['fatal', 'graceful'] },
    },
    reason: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description:
        'Optional human-readable deterministic reason supplied by the processor or contract. It is content in the selected document and in emitted lifecycle events when present.\n',
    },
  },
  '9GEC24YbFG9hj4banjYh2oEnDpAob1wAPmhjuykJp8T1': {
    name: 'Channel Event Checkpoint',
    type: { blueId: '6zqbYGDGrMv5ReuEsjyzyyjjuqVnqDZxtY7RsPXdBTNy' },
    description:
      "Required processor-managed marker at contracts/checkpoint. It stores idempotency state for external channel deliveries. Checkpoints are never used for processor-managed Document Update, Triggered Event, Lifecycle Event, or Embedded Node channels. The processor creates this marker lazily when an external channel accepts an event and no checkpoint exists. It updates lastEvents by Direct Write after successful external channel processing. Checkpoint Direct Writes do not emit Document Update cascades. By default, lastEvents stores the normalized checkpoint subject for each external channel's raw contract-map key, and newness is determined by the channel's effective checkpointIdentityMode. Pointer escaping is used only when writing the member by Direct Write; it is not part of the stored key.\n",
    lastEvents: {
      type: { blueId: 'Efkz9D1ARMM7rU43w3rDNVqat1naS6qXKCqP4eHin3yG' },
      keyType: {
        type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      },
      description:
        'Required dictionary keyed by raw external-channel contract-map key. Each value is the previous normalized checkpoint subject for that external channel. The default subject is the preprocessed incoming event node.\n',
      schema: { required: true },
    },
  },
  Fbenow6tanFHkWzKiDD8fGxminQswQ1FecMRakaCx2WX: {
    name: 'Type Generalization Policy',
    type: { blueId: '6zqbYGDGrMv5ReuEsjyzyyjjuqVnqDZxtY7RsPXdBTNy' },
    description:
      'Optional processor-managed marker at contracts/generalization. It controls whether post-patch type soundness may be restored by dynamic type generalization in the current scope. If absent, the processor uses defaultMode nearest-valid with no rules. Handlers and channels must not patch this marker or its descendants in Blue Contracts and Processor 1.0.\n',
    defaultMode: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description:
        'Optional default generalization mode for paths not governed by a more specific rule. Missing means nearest-valid. nearest-valid permits the processor to choose the nearest valid permitted ancestor type. reject makes a patch fatal when restoring soundness would require generalization.\n',
      schema: { enum: ['nearest-valid', 'reject'] },
    },
    rules: {
      type: { blueId: '8DSFoWG9MqRSUhStqoPLrwVQiYByRh18NWbDEarN8MKF' },
      itemType: {
        type: { blueId: '7Vnmk8StjwY7e9mBNpACrn8oh3KZ7yQBjnXe5bLDWn4D' },
      },
      description:
        'Optional ordered list of path-specific generalization rules. The most specific matching path wins; if two rules normalize to the same path, the later rule in list order wins.\n',
    },
  },
  '7Vnmk8StjwY7e9mBNpACrn8oh3KZ7yQBjnXe5bLDWn4D': {
    name: 'Type Generalization Rule',
    description:
      'Rule entry used by Type Generalization Policy. It governs a scope-relative subtree path and can reject dynamic generalization or require the generated type to remain equal to or a subtype of a declared floor type.\n',
    path: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description:
        'Required scope-relative Blue Runtime Pointer identifying the governed subtree. The pointer is normalized against the scope containing the policy marker before rule selection.\n',
      schema: { required: true },
    },
    mode: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description:
        'Optional mode for this path. Missing means the policy defaultMode. reject forbids generalization at the governed path. nearest-valid permits the nearest valid permitted ancestor type.\n',
      schema: { enum: ['nearest-valid', 'reject'] },
    },
    mustRemainSubtypeOf: {
      description:
        'Optional type reference floor. If present, any generated type selected for the governed path must be equal to or a subtype of this type.\n',
    },
  },
  Ac9LC5T7pHVa1TtkhMBjBRtxecShzvbe7ugUdXT1Mu2o: {
    name: 'Document Update Channel',
    type: { blueId: '4FAZ94JPExNM4pn2ZhtdHa4CVP7uASmLNVrBy7aCG1p5' },
    description:
      'Processor-managed channel fed after each successful runtime patch. For every successful patch, the processor discovers matching Document Update Channels from the post-patch selected document and delivers one Document Update payload per participating scope, from the patch origin scope toward root. A Document Update Channel matches when the absolute changed path is descendant-or-equal to the channel path resolved against the receiving scope. The channel is never checkpoint-gated and is never entered directly by external events. Triggered FIFO is not drained during Document Update cascades.\n',
    path: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description:
        'Required scope-relative Blue Runtime Pointer watched by this channel. The channel matches patches whose absolute changed path is descendant-or-equal to ABS(scope, path).\n',
      schema: { required: true },
    },
  },
  '5HwxfbwRBCxG8xYpowWkCPC9akqUSKV7So2M4QHEmLsZ': {
    name: 'Triggered Event Channel',
    type: { blueId: '4FAZ94JPExNM4pn2ZhtdHa4CVP7uASmLNVrBy7aCG1p5' },
    description:
      "Processor-managed channel that drains events emitted into a scope's Triggered FIFO. A scope drains its Triggered FIFO at most once per PROCESS invocation, during the scope's FIFO phase. Triggered FIFO delivery does not occur during Document Update cascades. If a scope has no Triggered Event Channel, emitted events are still recorded and may be bridged to a parent, but they are not locally delivered.\n",
  },
  '2DXGQUiQBQ6CT89jwAsTAXaEPhLgiSXhKCGh9Q7Hv3MQ': {
    name: 'Lifecycle Event Channel',
    type: { blueId: '4FAZ94JPExNM4pn2ZhtdHa4CVP7uASmLNVrBy7aCG1p5' },
    description:
      'Processor-managed channel for lifecycle events emitted by the processor at a scope. Lifecycle events include Document Processing Initiated and Document Processing Terminated. Lifecycle events are delivered through Lifecycle Event Channels, recorded as bridgeable emissions for parent Embedded Node Channels, and, at root, appended to the root outbox. Lifecycle events are not enqueued into the Triggered FIFO unless a lifecycle handler explicitly emits a Triggered event.\n',
  },
  H6iUJp3GcLypsJDimMSVoxQQdxxuD8j6eqEUWWqCZ6i: {
    name: 'Embedded Node Channel',
    type: { blueId: '4FAZ94JPExNM4pn2ZhtdHa4CVP7uASmLNVrBy7aCG1p5' },
    description:
      "Processor-managed channel in a parent scope that bridges recorded emissions from a processed embedded child scope. Bridging occurs after the parent has handled the external event and before the parent drains its Triggered FIFO. Child emissions are delivered in the order recorded by the child, and child scopes are bridged in the parent invocation's processed-path insertion order. Bridge gas is charged only when an emission is actually delivered to at least one matching Embedded Node Channel.\n",
    childPath: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description:
        'Required scope-relative Blue Runtime Pointer identifying the embedded child root whose emissions this channel receives. The resolved child path is compared with the processed child scope path.\n',
      schema: { required: true },
    },
  },
  '7HEaG1SpBdsbVHsrwRTZSZGmpJUWHfFoEzecYWpjo1vm': {
    name: 'Document Update',
    description:
      'Processor-emitted event delivered through Document Update Channels after each successful runtime patch. One Document Update payload is created per participating receiving scope for that patch. The path is relative to the receiving scope. before and after are immutable snapshots of the changed path before and after the patch, using null when the changed path was absent or removed. All handlers at the same receiving scope for the same patch see the same immutable payload object.\n',
    op: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description:
        'Required operation that caused the update: add, replace, or remove.\n',
      schema: { required: true, enum: ['add', 'replace', 'remove'] },
    },
    path: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description:
        'Required path of the changed node, relative to the receiving scope. / means the receiving scope root itself.\n',
      schema: { required: true },
    },
    before: {
      description:
        'Snapshot at the changed path before the patch, or null when absent.\n',
    },
    after: {
      description:
        'Snapshot at the changed path after the patch, or null when removed.\n',
    },
  },
  Ht1o66MTLKf7JmnEiR27rRLSwdz8FUTgf2mGPNuLSDUL: {
    name: 'Document Processing Initiated',
    description:
      'Processor-emitted lifecycle event published at a scope before the Processing Initialized Marker is written. It represents first-run initialization of that scope for the current selected document state. At root, this event is also recorded in the root outbox. At non-root scopes, it is bridgeable to a parent Embedded Node Channel. The documentId field is the pre-initialization Content BlueId of the scope subtree.\n',
    documentId: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description:
        'Required BlueId string for the pre-initialization Content BlueId of the scope subtree.\n',
      schema: { required: true },
    },
  },
  '4HWncQEQsdpk8zcXxYxgdtoXo5nKHxFPWeJfTscCbmeK': {
    name: 'Document Processing Terminated',
    description:
      'Processor-emitted lifecycle event published at a scope when that scope terminates gracefully or fatally. It is delivered through Lifecycle Event Channels, recorded as bridgeable for parent Embedded Node Channels, and, at root, included in the root outbox. For a root fatal termination, this event appears before Document Processing Fatal Error.\n',
    cause: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description: 'Required termination cause: fatal or graceful.\n',
      schema: { required: true, enum: ['fatal', 'graceful'] },
    },
    reason: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description: 'Optional deterministic reason for termination.\n',
    },
  },
  AMZbj5tNGxjPrvaNyw56sfqcLSW2j1XmkncEYUVtgmVC: {
    name: 'Document Processing Fatal Error',
    description:
      'Processor-emitted root outbox event appended when root processing terminates fatally. It is appended after Document Processing Terminated for the same root termination sequence. It is outbox-only: it is not delivered to Lifecycle Event Channels, is not recorded as bridgeable, and is not placed in the Triggered FIFO.\n',
    reason: {
      type: { blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC' },
      description: 'Optional deterministic fatal error reason.\n',
    },
  },
} satisfies Record<string, JsonValue>;

export const BUILTIN_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP: Record<string, string> =
  Object.fromEntries(
    Object.entries(BUILTIN_RUNTIME_TYPE_CONTENT_BY_BLUE_ID).map(
      ([blueId, content]) => [(content as { name: string }).name, blueId],
    ),
  );

const BUILTIN_RUNTIME_TYPES_META = Object.fromEntries(
  Object.entries(BUILTIN_RUNTIME_TYPE_CONTENT_BY_BLUE_ID).map(
    ([blueId, content]) => [
      blueId,
      {
        status: 'stable' as const,
        name: (content as { name: string }).name,
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: blueId,
            attributesAdded: [],
          },
        ],
      },
    ],
  ),
);

export const BUILTIN_RUNTIME_TYPES_REPOSITORY: BlueRepository = {
  name: 'blue.builtin-runtime-types',
  repositoryVersions: ['blue.builtin-runtime-types/v1'],
  packages: {
    builtinRuntimeTypes: {
      name: 'builtinRuntimeTypes',
      aliases: {},
      typesMeta: BUILTIN_RUNTIME_TYPES_META,
      contents: BUILTIN_RUNTIME_TYPE_CONTENT_BY_BLUE_ID,
      schemas: {},
    },
  },
};
