import { Blue, BlueNode } from '@blue-labs/language';
import { repository as coreRepository } from '@blue-repository/core';
import { repository as conversationRepository } from '@blue-repository/conversation';

import { ContractLoader } from '../engine/contract-loader.js';
import { ProcessorEngine } from '../engine/processor-engine.js';
import type { MarkerContract } from '../model/index.js';
import { ContractProcessorRegistry } from '../registry/contract-processor-registry.js';
import { ContractProcessorRegistryBuilder } from '../registry/contract-processor-registry-builder.js';
import type { AnyContractProcessor } from '../registry/types.js';
import type { DocumentProcessingResult } from '../types/document-processing-result.js';

const DEFAULT_BLUE = new Blue({
  repositories: [coreRepository, conversationRepository],
});

export interface DocumentProcessorOptions {
  readonly blue?: Blue;
  readonly registry?: ContractProcessorRegistry;
}

export class DocumentProcessor {
  private readonly blue: Blue;
  private readonly registryRef: ContractProcessorRegistry;
  private readonly contractLoaderRef: ContractLoader;
  private readonly engine: ProcessorEngine;

  constructor(options?: DocumentProcessorOptions) {
    this.registryRef =
      options?.registry ??
      ContractProcessorRegistryBuilder.create().registerDefaults().build();
    this.blue = options?.blue ?? DEFAULT_BLUE;
    this.contractLoaderRef = new ContractLoader(this.registryRef, this.blue);
    this.engine = new ProcessorEngine(
      this.contractLoaderRef,
      this.registryRef,
      this.blue,
    );
  }

  registerContractProcessor(processor: AnyContractProcessor): this {
    this.registryRef.register(processor);
    return this;
  }

  initializeDocument(document: BlueNode): DocumentProcessingResult {
    return this.engine.initializeDocument(document);
  }

  processDocument(
    document: BlueNode,
    event: BlueNode,
  ): DocumentProcessingResult {
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

  build(): DocumentProcessor {
    return new DocumentProcessor({
      registry: this.contractRegistry,
      blue: this.blueInstance,
    });
  }
}
