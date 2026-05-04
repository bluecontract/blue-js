import type { BlueNode } from '@blue-labs/language';

import type { ContractProcessorContext } from '../../types.js';

export type JavaScriptCodeV2Mode = 'script' | 'module' | 'auto';

export interface JavaScriptCodeV2StepModel {
  readonly code?: string;
  readonly mode?: string;
  readonly entryExport?: string;
  readonly modules?: Record<string, string>;
  readonly libraries?: readonly string[];
}

export function readJavaScriptCodeV2Step(
  stepNode: BlueNode,
): JavaScriptCodeV2StepModel {
  const props = stepNode.getProperties() ?? {};
  const code = readOptionalString(props.code);
  const mode = readOptionalString(props.mode);
  const entryExport = readOptionalString(props.entryExport);

  return {
    ...(code ? { code } : {}),
    ...(mode ? { mode } : {}),
    ...(entryExport ? { entryExport } : {}),
    ...(props.modules ? { modules: readStringRecord(props.modules) } : {}),
    ...(props.libraries ? { libraries: readStringList(props.libraries) } : {}),
  };
}

export function readJavaScriptCodeV2Mode(
  value: string | undefined,
  context: ContractProcessorContext,
): JavaScriptCodeV2Mode {
  if (value === undefined || value === '' || value === 'auto') {
    return 'auto';
  }
  if (value === 'script' || value === 'module') {
    return value;
  }
  return context.throwFatal(
    `Unsupported JavaScript Code v2 mode "${value}"; expected script, module, or auto`,
  );
}

export function readOptionalString(
  node: BlueNode | undefined,
): string | undefined {
  const value = node?.getValue();
  return typeof value === 'string' && value.length > 0 ? value : undefined;
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

function readStringList(node: BlueNode): readonly string[] {
  return (node.getItems() ?? [])
    .map((item) => item.getValue())
    .filter((value): value is string => typeof value === 'string');
}
