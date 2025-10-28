import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from './BlueDocumentProcessor';

export const prepareToProcess = async (
  doc: unknown,
  deps: {
    blue: Blue;
    documentProcessor: BlueDocumentProcessor;
  }
) => {
  const { blue, documentProcessor } = deps;
  const docNode = blue.jsonValueToNode(doc);
  const resolvedDocNode = blue.resolve(docNode);

  const initResult = await documentProcessor.initialize(resolvedDocNode);
  if (initResult.capabilityFailure) {
    throw new Error(
      `Initialization failed: ${initResult.failureReason ?? 'unknown capability failure'}`
    );
  }

  const { state: initializedState } = initResult;

  return {
    initializedState,
  };
};

export const prepareToProcessYaml = async (
  doc: string,
  deps: {
    blue: Blue;
    documentProcessor: BlueDocumentProcessor;
  }
) => {
  const { blue, documentProcessor } = deps;
  const docNode = blue.yamlToNode(doc);
  const resolvedDocNode = blue.resolve(docNode);

  const initResult = await documentProcessor.initialize(resolvedDocNode);
  if (initResult.capabilityFailure) {
    throw new Error(
      `Initialization failed: ${initResult.failureReason ?? 'unknown capability failure'}`
    );
  }

  const { state: initializedState } = initResult;

  return {
    initializedState,
  };
};
