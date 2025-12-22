import { describe, expect, it } from 'vitest';
import {
  normalizeBlueContextRepositories,
  parseBlueContextRepositories,
} from '../BlueContextRepositoriesParser';
import { BlueError, BlueErrorCode } from '../../errors/BlueError';

describe('BlueContextRepositoriesParser', () => {
  it('parses comma separated repositories with quotes', () => {
    const input = `'Repo A'=R1, "Repo B" = R2 , RepoC=R3`;
    const parsed = parseBlueContextRepositories(input);
    expect(parsed).toEqual({
      'Repo A': 'R1',
      'Repo B': 'R2',
      RepoC: 'R3',
    });
  });

  it('normalizes string or object inputs', () => {
    const str = `one=A, two=B`;
    const obj = { one: 'A', two: 'B' };

    expect(normalizeBlueContextRepositories(str)).toEqual(obj);
    expect(normalizeBlueContextRepositories(obj)).toEqual(obj);
  });

  it('returns an empty object for empty input', () => {
    expect(parseBlueContextRepositories('')).toEqual({});
    expect(parseBlueContextRepositories('   ')).toEqual({});
  });

  it('keeps last duplicate repository name', () => {
    const input = `Repo=R1, Repo=R2`;
    const parsed = parseBlueContextRepositories(input);
    expect(parsed).toEqual({ Repo: 'R2' });
  });

  it('throws on invalid syntax', () => {
    const badInputs = [
      `RepoR1`,
      `Repo=`,
      `'Repo`,
      `Repo=R1,`,
      `Repo=R1,   `,
      `""=R1`,
      `Repo=""`,
      `Repo=R=1`,
      `"Repo, A"=R1`,
    ];
    for (const input of badInputs) {
      expect(() => parseBlueContextRepositories(input)).toThrow(BlueError);
      try {
        parseBlueContextRepositories(input);
      } catch (err) {
        expect((err as BlueError).code).toEqual(
          BlueErrorCode.INVALID_BLUE_CONTEXT_REPOSITORIES,
        );
      }
    }
  });

  it('rejects prototype pollution keys', () => {
    const badKeys = ['__proto__', 'constructor', 'prototype'];
    for (const key of badKeys) {
      const input = `${key}=R1`;
      expect(() => parseBlueContextRepositories(input)).toThrow(BlueError);
      try {
        parseBlueContextRepositories(input);
      } catch (err) {
        const error = err as BlueError;
        expect(error.code).toEqual(
          BlueErrorCode.INVALID_BLUE_CONTEXT_REPOSITORIES,
        );
      }
    }
  });
});
