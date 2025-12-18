import { BlueNode, NodeDeserializer } from '../model';
import {
  RegisteredRepositoryRuntime,
  RepositoryRegistry,
} from '../repository/RepositoryRuntime';
import { NodeTransformer } from './NodeTransformer';
import { BlueError, BlueErrorCode } from '../errors/BlueError';
import { CORE_TYPE_BLUE_IDS, OBJECT_SPECIFIC_KEYS } from './Properties';
import { collectDropPointers } from './repositoryVersioning/dropPointers';
import { parsePointer as parseRepositoryPointer } from '@blue-labs/repository-contract';

interface SerializerOptions {
  registry: RepositoryRegistry;
  targetRepoVersionIndexes: Record<string, number>;
  fallbackToCurrentInlineDefinitions: boolean;
}

type ResolveResult =
  | { kind: 'core'; blueId: string }
  | { kind: 'no-runtime' }
  | {
      kind: 'no-target-context';
      currentBlueId: string;
      runtimeName: string;
      runtime: RegisteredRepositoryRuntime;
      meta: RegisteredRepositoryRuntime['types'][string];
      typeAlias?: string;
    }
  | {
      kind: 'representable';
      currentBlueId: string;
      targetBlueId: string;
      dropPointers: string[];
    }
  | { kind: 'unrepresentable'; currentBlueId: string; error: BlueError };

export class RepositoryVersionSerializer {
  private readonly registry: RepositoryRegistry;
  private readonly targetRepoVersionIndexes: Record<string, number>;
  private readonly fallbackToCurrentInlineDefinitions: boolean;
  private readonly inliningStack = new Set<string>();

  constructor(options: SerializerOptions) {
    this.registry = options.registry;
    this.targetRepoVersionIndexes = options.targetRepoVersionIndexes;
    this.fallbackToCurrentInlineDefinitions =
      options.fallbackToCurrentInlineDefinitions;
  }

  public transform(node: BlueNode): BlueNode {
    return NodeTransformer.transform(node, (current) =>
      this.transformNode(current),
    );
  }

  private transformNode(node: BlueNode): BlueNode {
    this.processTypeReference(node, {
      getter: () => node.getType(),
      setter: (value) => node.setType(value),
      dropTargets: [node],
    });

    this.processTypeReference(node, {
      getter: () => node.getItemType(),
      setter: (value) => node.setItemType(value),
      dropTargets: node.getItems() ?? [],
    });

    this.processTypeReference(node, {
      getter: () => node.getKeyType(),
      setter: (value) => node.setKeyType(value),
      dropTargets: [],
    });

    this.processTypeReference(node, {
      getter: () => node.getValueType(),
      setter: (value) => node.setValueType(value),
      dropTargets: this.getDictionaryValueTargets(node),
    });

    return node;
  }

  private processTypeReference(
    node: BlueNode,
    options: {
      getter: () => BlueNode | undefined;
      setter: (value: BlueNode | undefined) => void;
      dropTargets: BlueNode[];
    },
  ) {
    const typeNode = options.getter();
    const blueId = typeNode?.getBlueId();

    if (!typeNode || !blueId) {
      return;
    }

    const resolution = this.resolveType(blueId);

    switch (resolution.kind) {
      case 'core': {
        typeNode.setBlueId(resolution.blueId);
        return;
      }
      case 'representable': {
        this.applyDropPointers(options.dropTargets, resolution.dropPointers);
        typeNode.setBlueId(resolution.targetBlueId);
        return;
      }
      case 'no-runtime':
      case 'no-target-context':
      case 'unrepresentable': {
        if (this.fallbackToCurrentInlineDefinitions) {
          this.inlineDefinition(node, options.setter, blueId);
          return;
        }
        const err =
          resolution.kind === 'unrepresentable'
            ? resolution.error
            : this.unrepresentableError(
                blueId,
                resolution.kind === 'no-target-context'
                  ? `Repository '${resolution.runtimeName}' not provided in BlueContext.`
                  : 'Type does not belong to any declared repository.',
                resolution.kind === 'no-target-context'
                  ? resolution.runtime
                  : undefined,
                resolution.kind === 'no-target-context'
                  ? resolution.meta
                  : undefined,
                undefined,
                resolution.kind === 'no-target-context'
                  ? resolution.typeAlias
                  : undefined,
              );
        throw err;
      }
    }
  }

  private resolveType(blueId: string): ResolveResult {
    if ((CORE_TYPE_BLUE_IDS as readonly string[]).includes(blueId)) {
      return { kind: 'core', blueId };
    }

    const normalized = this.registry.toCurrentBlueId(blueId);
    const owned = this.registry.findRuntimeByBlueId(normalized);
    if (!owned || !owned.typeMeta) {
      return { kind: 'no-runtime' };
    }

    const targetRepoVersionIndex =
      this.targetRepoVersionIndexes[owned.runtime.name];

    if (targetRepoVersionIndex === undefined) {
      return {
        kind: 'no-target-context',
        currentBlueId: normalized,
        runtimeName: owned.runtime.name,
        runtime: owned.runtime,
        meta: owned.typeMeta,
        typeAlias: owned.typeAlias,
      };
    }

    const meta = owned.typeMeta;
    if (meta.status === 'dev') {
      const currentIndex = owned.runtime.repositoryVersions.length - 1;
      if (targetRepoVersionIndex !== currentIndex) {
        return {
          kind: 'unrepresentable',
          currentBlueId: normalized,
          error: this.unrepresentableError(
            normalized,
            `Dev type cannot be represented at repository version index ${targetRepoVersionIndex}.`,
            owned.runtime,
            meta,
            targetRepoVersionIndex,
            owned.typeAlias,
          ),
        };
      }
      const devVersion = meta.versions?.[0];
      return {
        kind: 'representable',
        currentBlueId: normalized,
        targetBlueId: devVersion?.typeBlueId ?? normalized,
        dropPointers: [],
      };
    }

    const versions = meta.versions || [];
    if (versions.length === 0) {
      return {
        kind: 'unrepresentable',
        currentBlueId: normalized,
        error: this.unrepresentableError(
          normalized,
          `Stable type metadata missing versions for ${normalized}.`,
          owned.runtime,
          meta,
          targetRepoVersionIndex,
          owned.typeAlias,
        ),
      };
    }

    const firstIndex = versions[0].repositoryVersionIndex;
    if (targetRepoVersionIndex < firstIndex) {
      return {
        kind: 'unrepresentable',
        currentBlueId: normalized,
        error: this.unrepresentableError(
          normalized,
          `Type introduced after target repository version index ${targetRepoVersionIndex}.`,
          owned.runtime,
          meta,
          targetRepoVersionIndex,
          owned.typeAlias,
        ),
      };
    }

    let chosen = versions[0].typeBlueId;
    for (const version of versions) {
      if (version.repositoryVersionIndex <= targetRepoVersionIndex) {
        chosen = version.typeBlueId;
      }
    }

    const dropPointers =
      meta.status === 'stable'
        ? this.getDropPointers(meta, targetRepoVersionIndex)
        : [];

    return {
      kind: 'representable',
      currentBlueId: normalized,
      targetBlueId: chosen,
      dropPointers,
    };
  }

  private getDropPointers(
    meta: RegisteredRepositoryRuntime['types'][string],
    targetRepoVersionIndex: number,
  ): string[] {
    if (meta.status !== 'stable') {
      return [];
    }
    return collectDropPointers(meta.versions, targetRepoVersionIndex);
  }

  private applyDropPointers(targets: BlueNode[], pointers: string[]) {
    for (const pointer of pointers) {
      for (const target of targets) {
        this.deletePropertyAtPointer(target, pointer);
      }
    }
  }

  private getDictionaryValueTargets(node: BlueNode): BlueNode[] {
    const props = node.getProperties();
    if (!props) {
      return [];
    }
    const RESERVED_KEYS = new Set<string>([
      ...OBJECT_SPECIFIC_KEYS,
      'schema',
      'mergePolicy',
      'contracts',
    ]);
    return Object.entries(props)
      .filter(
        ([key, value]) => value instanceof BlueNode && !RESERVED_KEYS.has(key),
      )
      .map(([, value]) => value as BlueNode);
  }

  private deletePropertyAtPointer(target: BlueNode, pointer: string) {
    let segments: string[];
    try {
      segments = parseRepositoryPointer(pointer);
    } catch {
      throw this.invalidPointerError(pointer);
    }

    this.applyPointerSegments(target, segments);
  }

  private applyPointerSegments(node: BlueNode, segments: string[]) {
    if (segments.length === 0) {
      return;
    }

    const [segment, ...rest] = segments;

    if (segment === 'itemType') {
      const itemType = node.getItemType();
      if (itemType) {
        this.applyPointerSegments(itemType, rest);
      }
      const items = node.getItems();
      if (items) {
        items.forEach((item) => this.applyPointerSegments(item, rest));
      }
      return;
    }

    if (segment === 'valueType') {
      const valueType = node.getValueType();
      if (valueType) {
        this.applyPointerSegments(valueType, rest);
      }
      const values = this.getDictionaryValueTargets(node);
      values.forEach((value) => this.applyPointerSegments(value, rest));
      return;
    }

    const properties = node.getProperties();
    if (!properties) {
      return;
    }

    if (rest.length === 0) {
      if (!(segment in properties)) {
        return;
      }
      const updated = { ...properties };
      delete updated[segment];
      node.setProperties(updated);
      return;
    }

    const child = properties[segment];
    if (child instanceof BlueNode) {
      this.applyPointerSegments(child, rest);
    }
  }

  private inlineDefinition(
    node: BlueNode,
    setter: (value: BlueNode | undefined) => void,
    blueId: string,
  ): BlueNode {
    const currentBlueId = this.registry.toCurrentBlueId(blueId);

    if (this.inliningStack.has(currentBlueId)) {
      throw this.unrepresentableError(
        currentBlueId,
        'Cycle detected while inlining type.',
        undefined,
        undefined,
        undefined,
        undefined,
        {
          cycle: Array.from(this.inliningStack).concat(currentBlueId),
        },
      );
    }

    const definition = this.registry.getContents()[currentBlueId];
    if (!definition) {
      throw this.unrepresentableError(
        currentBlueId,
        `Missing definition to inline for BlueId ${currentBlueId}.`,
      );
    }

    this.inliningStack.add(currentBlueId);
    try {
      const inlineNode = NodeDeserializer.deserialize(definition);
      inlineNode.setBlueId(undefined);
      const transformedInline = NodeTransformer.transform(inlineNode, (n) =>
        this.transformNode(n),
      );
      setter(transformedInline);
      return node;
    } finally {
      this.inliningStack.delete(currentBlueId);
    }
  }

  private invalidPointerError(pointer: string): BlueError {
    const message = `Invalid attributesAdded pointer '${pointer}'.`;
    return new BlueError(BlueErrorCode.INVALID_REPOSITORY_POINTER, message, [
      {
        code: BlueErrorCode.INVALID_REPOSITORY_POINTER,
        severity: 'error',
        message,
        locationPath: [],
        context: { pointer },
      },
    ]);
  }

  private unrepresentableError(
    currentBlueId: string,
    message: string,
    runtime?: RegisteredRepositoryRuntime,
    meta?: RegisteredRepositoryRuntime['types'][string],
    targetRepoVersionIndex?: number,
    typeAlias?: string,
    extraContext?: Record<string, unknown>,
  ): BlueError {
    const context: Record<string, unknown> = {
      currentTypeBlueId: currentBlueId,
      targetRepoVersionIndex,
      typeAlias,
      ...extraContext,
    };

    if (runtime) {
      if (targetRepoVersionIndex !== undefined) {
        context.requestedRepoBlueId =
          runtime.repositoryVersions[targetRepoVersionIndex];
      }
      context.serverRepoBlueId = runtime.currentRepoBlueId;
    }

    if (meta && meta.status === 'stable') {
      const introducedIdx = meta.versions?.[0]?.repositoryVersionIndex;
      if (introducedIdx !== undefined) {
        context.typeIntroducedInRepoBlueId =
          runtime?.repositoryVersions[introducedIdx];
      }
    }

    const detail = {
      code: BlueErrorCode.REPO_UNREPRESENTABLE_IN_TARGET_VERSION,
      severity: 'error' as const,
      message,
      locationPath: ['type'],
      context,
    };

    return new BlueError(
      BlueErrorCode.REPO_UNREPRESENTABLE_IN_TARGET_VERSION,
      message,
      [detail],
    );
  }
}
