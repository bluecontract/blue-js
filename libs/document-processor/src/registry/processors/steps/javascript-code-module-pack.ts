import {
  buildModulePackFromSources,
  computeModulePackGraphHash,
  type ExecutionProfile,
  type ModulePackSourceEntry,
  type ModulePackV1,
} from '@blue-quickjs/quickjs-runtime';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import type { BlueNode } from '@blue-labs/language';

import type { ContractProcessorContext } from '../../types.js';

export const JAVASCRIPT_CODE_V2_ENTRY_SPECIFIER = './entry.js';

const JAVASCRIPT_CODE_V2_BUILDER_VERSION =
  'blue-js-document-processor-javascript-code-v2';

const HEX64_RE = /^[0-9a-f]{64}$/;

export interface JavaScriptCodeV2ModulePackInput {
  readonly code: string;
  readonly entryExport?: string;
  readonly modules?: Record<string, string>;
  readonly libraries?: readonly string[];
}

interface JavaScriptLibraryModel {
  readonly modules?: Record<string, string>;
  readonly package?: {
    readonly registry?: string;
    readonly packageName?: string;
    readonly version?: string;
    readonly sourceIntegritySha256?: string;
  };
  readonly artifact?: {
    readonly builderVersion?: string;
    readonly dependencyIntegrity?: string;
    readonly graphHash?: string;
    readonly modulePack?: BlueNode;
  };
  readonly moduleAliases?: Record<string, string>;
}

export async function buildJavaScriptCodeV2ModulePack(
  input: JavaScriptCodeV2ModulePackInput,
  context: ContractProcessorContext,
  executionProfile: ExecutionProfile,
): Promise<ModulePackV1> {
  const sources: ModulePackSourceEntry[] = [
    {
      specifier: JAVASCRIPT_CODE_V2_ENTRY_SPECIFIER,
      source: input.code,
    },
  ];
  const importAliases: Record<string, string> = {};

  if (input.modules) {
    for (const [specifier, source] of Object.entries(input.modules)) {
      sources.push({ specifier, source });
    }
  }

  for (const pointer of input.libraries ?? []) {
    const library = readLibrary(pointer, context);
    if (library.modules) {
      for (const [specifier, source] of Object.entries(library.modules)) {
        sources.push({ specifier, source });
      }
    }
    if (library.artifact) {
      const modulePack = await readAndVerifyArtifactModulePack(
        library,
        library.artifact,
        context,
        pointer,
      );
      for (const module of modulePack.modules) {
        sources.push({
          specifier: module.specifier,
          source: module.source,
          ...(module.sourceMap ? { sourceMap: module.sourceMap } : {}),
          ...(module.originMeta ? { originMeta: module.originMeta } : {}),
        });
      }
    }
    if (library.moduleAliases) {
      for (const [alias, target] of Object.entries(library.moduleAliases)) {
        const existing = importAliases[alias];
        if (existing !== undefined && existing !== target) {
          return context.throwFatal(
            `Conflicting JavaScript library alias "${alias}"`,
          );
        }
        importAliases[alias] = target;
      }
    }
  }

  try {
    return await buildModulePackFromSources({
      entrySpecifier: JAVASCRIPT_CODE_V2_ENTRY_SPECIFIER,
      entryExport: input.entryExport ?? 'default',
      sources,
      importAliases,
      profile: executionProfile,
      builderVersion: JAVASCRIPT_CODE_V2_BUILDER_VERSION,
      rejectIncompatible: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return context.throwFatal(
      `JavaScript Code v2 module graph invalid: ${message}`,
    );
  }
}

function readLibrary(
  pointer: string,
  context: ContractProcessorContext,
): JavaScriptLibraryModel {
  const absolutePointer = context.resolvePointer(pointer);
  const libraryNode = context.documentAt(absolutePointer);
  if (!libraryNode) {
    return context.throwFatal(
      `JavaScript Code v2 library not found at "${absolutePointer}"`,
    );
  }
  const type = libraryNode.getType();
  const blueId = type?.getBlueId();
  const typeName = type?.getName();
  if (
    blueId !== conversationBlueIds['Conversation/JavaScript Library'] &&
    typeName !== 'Conversation/JavaScript Library'
  ) {
    return context.throwFatal(
      `JavaScript Code v2 library reference "${absolutePointer}" must point to Conversation/JavaScript Library`,
    );
  }
  const props = libraryNode.getProperties() ?? {};
  const artifactProps = props.artifact?.getProperties();
  const packageProps = props.package?.getProperties();
  return {
    ...(props.modules ? { modules: readStringRecord(props.modules) } : {}),
    ...(packageProps
      ? {
          package: {
            ...(readOptionalString(packageProps.registry)
              ? { registry: readOptionalString(packageProps.registry) }
              : {}),
            ...(readOptionalString(packageProps.packageName)
              ? {
                  packageName: readOptionalString(packageProps.packageName),
                }
              : {}),
            ...(readOptionalString(packageProps.version)
              ? { version: readOptionalString(packageProps.version) }
              : {}),
            ...(readOptionalString(packageProps.sourceIntegritySha256)
              ? {
                  sourceIntegritySha256: readOptionalString(
                    packageProps.sourceIntegritySha256,
                  ),
                }
              : {}),
          },
        }
      : {}),
    ...(artifactProps
      ? {
          artifact: {
            ...(readOptionalString(artifactProps.builderVersion)
              ? {
                  builderVersion: readOptionalString(
                    artifactProps.builderVersion,
                  ),
                }
              : {}),
            ...(readOptionalString(artifactProps.dependencyIntegrity)
              ? {
                  dependencyIntegrity: readOptionalString(
                    artifactProps.dependencyIntegrity,
                  ),
                }
              : {}),
            ...(readOptionalString(artifactProps.graphHash)
              ? { graphHash: readOptionalString(artifactProps.graphHash) }
              : {}),
            ...(artifactProps.modulePack
              ? { modulePack: artifactProps.modulePack }
              : {}),
          },
        }
      : {}),
    ...(props.moduleAliases
      ? { moduleAliases: readStringRecord(props.moduleAliases) }
      : {}),
  };
}

async function readAndVerifyArtifactModulePack(
  library: JavaScriptLibraryModel,
  artifact: NonNullable<JavaScriptLibraryModel['artifact']>,
  context: ContractProcessorContext,
  pointer: string,
): Promise<ModulePackV1> {
  verifyArtifactPackageMetadata(library, context, pointer);
  if (!artifact.modulePack) {
    return context.throwFatal(
      `JavaScript library "${pointer}" artifact requires modulePack`,
    );
  }
  const modulePack = context.blue.nodeToJson(
    artifact.modulePack,
    'simple',
  ) as unknown as ModulePackV1;
  if (!isModulePack(modulePack)) {
    return context.throwFatal(
      `JavaScript library "${pointer}" artifact.modulePack is invalid`,
    );
  }
  if (artifact.graphHash && artifact.graphHash !== modulePack.graphHash) {
    return context.throwFatal(
      `JavaScript library "${pointer}" artifact graphHash does not match modulePack.graphHash`,
    );
  }
  if (
    artifact.builderVersion &&
    artifact.builderVersion !== modulePack.builderVersion
  ) {
    return context.throwFatal(
      `JavaScript library "${pointer}" artifact builderVersion does not match modulePack.builderVersion`,
    );
  }
  if (
    artifact.dependencyIntegrity &&
    artifact.dependencyIntegrity !== modulePack.dependencyIntegrity
  ) {
    return context.throwFatal(
      `JavaScript library "${pointer}" artifact dependencyIntegrity does not match modulePack.dependencyIntegrity`,
    );
  }

  const computedGraphHash = await computeModulePackGraphHash(modulePack);
  if (computedGraphHash !== modulePack.graphHash) {
    return context.throwFatal(
      `JavaScript library "${pointer}" artifact modulePack graphHash mismatch`,
    );
  }
  verifyArtifactOriginMetadata(library, modulePack, context, pointer);
  verifyArtifactMatchesDeclaredModules(library, modulePack, context, pointer);

  return modulePack;
}

function verifyArtifactPackageMetadata(
  library: JavaScriptLibraryModel,
  context: ContractProcessorContext,
  pointer: string,
): void {
  if (!library.package) {
    return context.throwFatal(
      `JavaScript library "${pointer}" artifact requires package metadata`,
    );
  }
  const packageName = library.package.packageName;
  const registry = library.package.registry;
  const version = library.package.version;
  const sourceIntegritySha256 = library.package.sourceIntegritySha256;
  if (!registry || !packageName || !version || !sourceIntegritySha256) {
    return context.throwFatal(
      `JavaScript library "${pointer}" artifact package requires registry, packageName, version, and sourceIntegritySha256`,
    );
  }
  if (!HEX64_RE.test(sourceIntegritySha256)) {
    return context.throwFatal(
      `JavaScript library "${pointer}" artifact package.sourceIntegritySha256 must be lowercase 64-character SHA-256 hex`,
    );
  }
}

function verifyArtifactOriginMetadata(
  library: JavaScriptLibraryModel,
  modulePack: ModulePackV1,
  context: ContractProcessorContext,
  pointer: string,
): void {
  const packageMetadata = library.package;
  if (!packageMetadata) {
    return;
  }
  const packageName = packageMetadata.packageName;
  const packageVersion = packageMetadata.version;
  for (const module of modulePack.modules) {
    const origin = module.originMeta;
    if (!origin) {
      continue;
    }
    if (
      packageName &&
      origin.packageName &&
      origin.packageName !== packageName
    ) {
      return context.throwFatal(
        `JavaScript library "${pointer}" artifact module ${module.specifier} packageName does not match package.packageName`,
      );
    }
    if (
      packageVersion &&
      origin.packageVersion &&
      origin.packageVersion !== packageVersion
    ) {
      return context.throwFatal(
        `JavaScript library "${pointer}" artifact module ${module.specifier} packageVersion does not match package.version`,
      );
    }
  }
}

function verifyArtifactMatchesDeclaredModules(
  library: JavaScriptLibraryModel,
  modulePack: ModulePackV1,
  context: ContractProcessorContext,
  pointer: string,
): void {
  if (!library.modules) {
    return;
  }
  const artifactModules = new Map(
    modulePack.modules.map((module) => [module.specifier, module.source]),
  );
  for (const [specifier, source] of Object.entries(library.modules)) {
    const artifactSource = artifactModules.get(specifier);
    if (artifactSource === undefined) {
      return context.throwFatal(
        `JavaScript library "${pointer}" declares module ${specifier} but artifact.modulePack does not contain it`,
      );
    }
    if (normalizeSourceText(artifactSource) !== normalizeSourceText(source)) {
      return context.throwFatal(
        `JavaScript library "${pointer}" module ${specifier} does not match artifact.modulePack source`,
      );
    }
  }
}

function readStringRecord(node: BlueNode): Record<string, string> {
  const properties = node.getProperties() ?? {};
  const result: Record<string, string> = {};
  for (const [key, valueNode] of Object.entries(properties)) {
    const value = valueNode.getValue();
    if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return result;
}

function readOptionalString(node: BlueNode | undefined): string | undefined {
  const value = node?.getValue();
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizeSourceText(source: string): string {
  return source.replace(/\r\n?/g, '\n');
}

function isModulePack(value: unknown): value is ModulePackV1 {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Partial<ModulePackV1>;
  return (
    record.version === 1 &&
    typeof record.entrySpecifier === 'string' &&
    Array.isArray(record.modules) &&
    typeof record.graphHash === 'string' &&
    HEX64_RE.test(record.graphHash) &&
    typeof record.builderVersion === 'string' &&
    typeof record.dependencyIntegrity === 'string' &&
    HEX64_RE.test(record.dependencyIntegrity) &&
    record.modules.every(
      (module) =>
        module !== null &&
        typeof module === 'object' &&
        typeof module.specifier === 'string' &&
        typeof module.source === 'string',
    )
  );
}
