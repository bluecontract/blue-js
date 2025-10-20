import { Blue } from '@blue-labs/language';

import { ContractLoader } from '../engine/contract-loader.js';
import { ProcessorEngine } from '../engine/processor-engine.js';
import type { MarkerContract } from '../model/index.js';
import { ContractProcessorRegistry } from '../registry/contract-processor-registry.js';
import { ContractProcessorRegistryBuilder } from '../registry/contract-processor-registry-builder.js';
import type { AnyContractProcessor } from '../registry/types.js';
import type { Node } from '../types/index.js';
import type { DocumentProcessingResult } from '../types/document-processing-result.js';
import type { ProcessorError } from '../types/errors.js';
import { err, ok, type Result } from '../types/result.js';

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
    this.blue = options?.blue ?? new Blue();
    this.contractLoaderRef = new ContractLoader(this.registryRef, this.blue);
    this.engine = new ProcessorEngine(
      this.contractLoaderRef,
      this.registryRef,
      this.blue
    );
  }

  registerContractProcessor(processor: AnyContractProcessor): this {
    this.registryRef.register(processor);
    return this;
  }

  initializeDocument(
    document: Node
  ): Result<DocumentProcessingResult, ProcessorError> {
    return this.engine.initializeDocument(document);
  }

  processDocument(
    document: Node,
    event: Node
  ): Result<DocumentProcessingResult, ProcessorError> {
    return this.engine.processDocument(document, event);
  }

  markersFor(
    scopeNode: Node,
    scopePath: string
  ): Result<Map<string, MarkerContract>, ProcessorError> {
    const bundleResult = this.contractLoaderRef.load(scopeNode, scopePath);
    if (!bundleResult.ok) {
      return err(bundleResult.error);
    }
    return ok(bundleResult.value.markers());
  }

  isInitialized(document: Node): boolean {
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

  build(): DocumentProcessor {
    return new DocumentProcessor({ registry: this.contractRegistry });
  }
}
