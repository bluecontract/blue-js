import { Blue } from '@blue-labs/language';
import {
  DocumentNode,
  ProcessingOptions,
  ProcessingResult,
} from './types';

type DocumentProcessorLike = {
  initialize(
    document: DocumentNode,
    options?: ProcessingOptions
  ): Promise<ProcessingResult>;
};

export const prepareToProcess = async (
  doc: unknown,
  deps: {
    blue: Blue;
    documentProcessor: DocumentProcessorLike;
  }
) => {
  const { blue, documentProcessor } = deps;
  const docNode = blue.jsonValueToNode(doc);
  const resolvedDocNode = blue.resolve(docNode);

  const { state: initializedState } = await documentProcessor.initialize(
    resolvedDocNode
  );

  return {
    initializedState,
  };
};

export const prepareToProcessYaml = async (
  doc: string,
  deps: {
    blue: Blue;
    documentProcessor: DocumentProcessorLike;
  }
) => {
  const { blue, documentProcessor } = deps;
  const docNode = blue.yamlToNode(doc);
  const resolvedDocNode = blue.resolve(docNode);

  const { state: initializedState } = await documentProcessor.initialize(
    resolvedDocNode
  );

  return {
    initializedState,
  };
};
