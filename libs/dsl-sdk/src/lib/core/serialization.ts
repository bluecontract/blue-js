import { createDefaultMergingProcessor } from '@blue-labs/document-processor';
import { Blue, BlueNode } from '@blue-labs/language';
import type { JsonObject, JsonValue } from './types.js';
import { blueRepository } from './semantic-repository.js';

export const sdkBlue = new Blue({
  repositories: [blueRepository],
  mergingProcessor: createDefaultMergingProcessor(),
});

export interface DocumentBuilderLike {
  buildDocument(): BlueNode;
}

export function fromJsonDocument(document: JsonObject): BlueNode {
  return sdkBlue.jsonValueToNode(document);
}

export function toOfficialJson(
  input: BlueNode | DocumentBuilderLike | JsonObject,
): JsonObject {
  if (isJsonObjectInput(input)) {
    return structuredClone(input);
  }
  const inlineTypesNode = sdkBlue.restoreInlineTypes(resolveNode(input));
  return sdkBlue.nodeToJson(inlineTypesNode, 'simple') as JsonObject;
}

export function toOfficialYaml(
  input: BlueNode | DocumentBuilderLike | JsonObject,
): string {
  const inlineTypesNode = sdkBlue.restoreInlineTypes(
    isJsonObjectInput(input) ? fromJsonDocument(input) : resolveNode(input),
  );
  return sdkBlue.nodeToYaml(inlineTypesNode, 'simple');
}

export function ensureExpression(value: string): JsonValue {
  return toBexExpression(value.trim());
}

function toBexExpression(expression: string): JsonValue {
  const addParts = splitTopLevelAddition(expression);
  if (addParts.length > 1) {
    return { $add: addParts.map((part) => toBexExpression(part)) };
  }

  const documentMatch = expression.match(/^document\(['"]([^'"]+)['"]\)$/u);
  if (documentMatch) {
    return { $document: normalizePointerExpression(documentMatch[1]) };
  }

  if (expression === 'event') {
    return { $event: '/' };
  }
  if (expression.startsWith('event.')) {
    return { $event: dottedPathToPointer(expression.slice('event.'.length)) };
  }

  if (expression === 'currentContract') {
    return { $currentContract: '/' };
  }
  if (expression.startsWith('currentContract.')) {
    return {
      $currentContract: dottedPathToPointer(
        expression.slice('currentContract.'.length),
      ),
    };
  }

  if (expression.startsWith('steps.')) {
    return { $steps: expression.slice('steps.'.length) };
  }

  if (/^-?\d+(?:\.\d+)?$/u.test(expression)) {
    return Number(expression);
  }

  const quoted = expression.match(/^(['"])(.*)\1$/u);
  if (quoted) {
    return quoted[2];
  }

  throw new Error(`Unsupported BEX expression shorthand: ${expression}`);
}

function splitTopLevelAddition(expression: string): string[] {
  const parts: string[] = [];
  let quote: "'" | '"' | null = null;
  let depth = 0;
  let start = 0;

  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (quote) {
      if (char === quote && expression[index - 1] !== '\\') {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char === ')') {
      depth -= 1;
      continue;
    }
    if (char === '+' && depth === 0) {
      parts.push(expression.slice(start, index).trim());
      start = index + 1;
    }
  }

  if (parts.length === 0) {
    return [expression];
  }
  parts.push(expression.slice(start).trim());
  return parts;
}

function normalizePointerExpression(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function dottedPathToPointer(path: string): string {
  return `/${path
    .split('.')
    .map((part) => part.replace(/~/gu, '~0').replace(/\//gu, '~1'))
    .join('/')}`;
}

function resolveNode(input: BlueNode | DocumentBuilderLike): BlueNode {
  return isBuilderLike(input) ? input.buildDocument() : input;
}

function isBuilderLike(
  value: BlueNode | DocumentBuilderLike,
): value is DocumentBuilderLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DocumentBuilderLike).buildDocument === 'function'
  );
}

function isJsonObjectInput(
  value: BlueNode | DocumentBuilderLike | JsonObject,
): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof BlueNode) &&
    typeof (value as DocumentBuilderLike).buildDocument !== 'function'
  );
}
