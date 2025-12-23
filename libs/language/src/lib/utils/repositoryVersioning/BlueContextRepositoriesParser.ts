import { BlueError, BlueErrorCode } from '../../errors/BlueError';
import { BlueContextRepositories } from '../../types/BlueContext';

const FORBIDDEN_REPOSITORY_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

function stripQuotes(value: string): string {
  const first = value.at(0);
  const last = value.at(-1);
  if (!first || !last) return value;
  if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
    return value.slice(1, -1);
  }
  return value;
}

function parsePair(
  segment: string,
  raw: string,
): { name: string; value: string } {
  const idx = segment.indexOf('=');
  if (idx === -1) {
    throw invalidError(raw, `Missing '=' in segment '${segment.trim()}'`);
  }
  if (segment.indexOf('=', idx + 1) !== -1) {
    throw invalidError(raw, `Unexpected '=' in segment '${segment.trim()}'`);
  }
  const name = stripQuotes(segment.slice(0, idx).trim());
  const value = stripQuotes(segment.slice(idx + 1).trim());

  if (!name) {
    throw invalidError(raw, 'Repository name is empty');
  }
  if (!value) {
    throw invalidError(raw, `Repository BlueId is empty for '${name}'`);
  }

  return { name, value };
}

export function parseBlueContextRepositories(
  input: string,
): Record<string, string> {
  if (input.trim().length === 0) {
    return Object.create(null) as Record<string, string>;
  }

  const repos = Object.create(null) as Record<string, string>;

  for (const segment of input.split(',')) {
    const trimmed = segment.trim();
    if (!trimmed) {
      throw invalidError(input, 'Empty repository segment');
    }
    const { name, value } = parsePair(trimmed, input);
    rejectForbiddenKey(name, input);
    repos[name] = value;
  }

  return repos;
}

export function normalizeBlueContextRepositories(
  input: BlueContextRepositories,
): Record<string, string> {
  if (typeof input === 'string') {
    return parseBlueContextRepositories(input);
  }
  return input;
}

function invalidError(raw: string, reason: string): BlueError {
  return new BlueError(
    BlueErrorCode.INVALID_BLUE_CONTEXT_REPOSITORIES,
    `Invalid BlueContext repositories value: ${reason}`,
    [
      {
        code: BlueErrorCode.INVALID_BLUE_CONTEXT_REPOSITORIES,
        message: reason,
        locationPath: [],
        context: {
          rawRepositories: raw,
          reason,
        },
      },
    ],
  );
}

function rejectForbiddenKey(name: string, raw: string) {
  if (FORBIDDEN_REPOSITORY_KEYS.has(name)) {
    throw invalidError(raw, `Forbidden repository name '${name}'`);
  }
}
