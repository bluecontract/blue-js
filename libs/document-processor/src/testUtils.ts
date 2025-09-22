import { Blue } from '@blue-labs/language';
import { NativeBlueDocumentProcessor } from './NativeBlueDocumentProcessor';

export const prepareToProcess = async (
  doc: unknown,
  deps: {
    blue: Blue;
    documentProcessor: NativeBlueDocumentProcessor;
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
    documentProcessor: NativeBlueDocumentProcessor;
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
