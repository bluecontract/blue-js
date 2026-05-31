import { Blue, BlueNode } from '@blue-labs/language';
import type { BexEngine } from '@blue-labs/bex';

import { ContractLoader } from '../engine/contract-loader.js';
import { createDefaultMergingProcessor } from '../merge/utils/default.js';
import { ProcessorEngine } from '../engine/processor-engine.js';
import type { ProcessorRuntimeHooks } from '../engine/processor-engine.js';
import type { MarkerContract } from '../model/index.js';
import { ContractProcessorRegistry } from '../registry/contract-processor-registry.js';
import { ContractProcessorRegistryBuilder } from '../registry/contract-processor-registry-builder.js';
import type { AnyContractProcessor } from '../registry/types.js';
import { blueRepository } from '../repository/semantic-repository.js';
import type { DocumentProcessingResult } from '../types/document-processing-result.js';

const DEFAULT_BLUE = new Blue({
  repositories: [blueRepository],
  mergingProcessor: createDefaultMergingProcessor(),
});

export interface DocumentProcessorOptions {
  readonly blue?: Blue;
  readonly bexEngine?: BexEngine;
  readonly registry?: ContractProcessorRegistry;
  readonly runtimeHooks?: ProcessorRuntimeHooks;
}

export class DocumentProcessor {
  private readonly blue: Blue;
  private readonly registryRef: ContractProcessorRegistry;
  private readonly contractLoaderRef: ContractLoader;
  private readonly engine: ProcessorEngine;

  constructor(options?: DocumentProcessorOptions) {
    this.registryRef =
      options?.registry ??
      ContractProcessorRegistryBuilder.create({
        bexEngine: options?.bexEngine,
      })
        .registerDefaults()
        .build();
    this.blue = options?.blue ?? DEFAULT_BLUE;
    this.contractLoaderRef = new ContractLoader(this.registryRef, this.blue);
    this.engine = new ProcessorEngine(
      this.contractLoaderRef,
      this.registryRef,
      this.blue,
      options?.runtimeHooks,
    );
  }

  registerContractProcessor(processor: AnyContractProcessor): this {
    this.registryRef.register(processor);
    return this;
  }

  async initializeDocument(
    document: BlueNode,
  ): Promise<DocumentProcessingResult> {
    return this.engine.initializeDocument(document);
  }

  async processDocument(
    document: BlueNode,
    event: BlueNode,
  ): Promise<DocumentProcessingResult> {
    return this.engine.processDocument(document, event);
  }

  markersFor(
    scopeNode: BlueNode,
    scopePath: string,
  ): Map<string, MarkerContract> {
    const bundle = this.contractLoaderRef.load(scopeNode, scopePath);
    return bundle.markers();
  }

  isInitialized(document: BlueNode): boolean {
    return this.engine.isInitialized(document);
  }

  getContractRegistry(): ContractProcessorRegistry {
    return this.registryRef;
  }

  /** @internal */
  registry(): ContractProcessorRegistry {
    return this.registryRef;
  }

  /** @internal */
  contractLoader(): ContractLoader {
    return this.contractLoaderRef;
  }

  static builder(): DocumentProcessorBuilder {
    return new DocumentProcessorBuilder();
  }
}

export class DocumentProcessorBuilder {
  private contractRegistry: ContractProcessorRegistry;
  private blueInstance: Blue | undefined;
  private bexEngine: BexEngine | undefined;

  constructor() {
    this.contractRegistry = ContractProcessorRegistryBuilder.create()
      .registerDefaults()
      .build();
  }

  withRegistry(registry: ContractProcessorRegistry): DocumentProcessorBuilder {
    this.contractRegistry = registry;
    return this;
  }

  registerDefaults(): DocumentProcessorBuilder {
    return this;
  }

  withBlue(blue: Blue): DocumentProcessorBuilder {
    this.blueInstance = blue;
    return this;
  }

  withBexEngine(bexEngine: BexEngine): DocumentProcessorBuilder {
    this.bexEngine = bexEngine;
    this.contractRegistry = ContractProcessorRegistryBuilder.create({
      bexEngine,
    })
      .registerDefaults()
      .build();
    return this;
  }

  build(): DocumentProcessor {
    return new DocumentProcessor({
      registry: this.contractRegistry,
      blue: this.blueInstance,
      bexEngine: this.bexEngine,
    });
  }
}
