import { describe, expect, it } from 'vitest';
import { Blue } from '../../Blue';
import { BlueError, BlueErrorCode } from '../../errors/BlueError';
import {
  createBlueInstance,
  expectBlueError,
  ids,
  otherRepository,
  repoBlue,
  repositoryVersions,
} from './fixtures';

describe('Repository versioning: errors and edge cases', () => {
  it('throws for types introduced after target repo version', () => {
    const blue = createBlueInstance();
    const node = blue.jsonValueToNode({
      type: { blueId: ids.auditInfo },
      notes: { type: { blueId: ids.text }, value: 'later' },
    });

    try {
      blue.nodeToJson(node, {
        blueContext: {
          repositories: { 'repo.blue': repositoryVersions[2] },
          fallbackToCurrentInlineDefinitions: false,
        },
      });
      throw new Error('expected to throw');
    } catch (err) {
      expectBlueError(err, {
        code: BlueErrorCode.REPO_UNREPRESENTABLE_IN_TARGET_VERSION,
        contextContains: {
          typeIntroducedInRepoBlueId: repositoryVersions[3],
        },
      });
    }
  });

  it('throws when a dev type is downgraded', () => {
    const blue = createBlueInstance();
    const node = blue.jsonValueToNode({
      type: { blueId: ids.subscription },
      subscriptionId: { type: { blueId: ids.text }, value: 'sub' },
    });

    expect(() =>
      blue.nodeToJson(node, {
        blueContext: {
          repositories: { 'repo.blue': repositoryVersions[2] },
          fallbackToCurrentInlineDefinitions: false,
        },
      }),
    ).toThrowError(BlueError);
  });

  it('includes runtime context when repository is missing in BlueContext', () => {
    const blue = createBlueInstance();
    const node = blue.jsonValueToNode({
      type: { blueId: ids.policyCurrent },
      owner: { type: { blueId: ids.text }, value: 'owner' },
    });

    try {
      blue.nodeToJson(node, {
        blueContext: {
          repositories: { 'other.repo': 'X0' },
          fallbackToCurrentInlineDefinitions: false,
        },
      });
      throw new Error('expected to throw');
    } catch (err) {
      expectBlueError(err, {
        code: BlueErrorCode.REPO_UNREPRESENTABLE_IN_TARGET_VERSION,
        contextContains: {
          serverRepoBlueId: repositoryVersions[3],
          currentTypeBlueId: ids.policyCurrent,
          typeIntroducedInRepoBlueId: repositoryVersions[0],
        },
      });
    }
  });

  it('inlines external types when fallback is enabled', () => {
    const blue = createBlueInstance();
    const node = blue.jsonValueToNode({
      type: { blueId: ids.policyCurrent },
      owner: { type: { blueId: ids.text }, value: 'owner' },
      rules: [
        {
          type: { blueId: ids.ruleCurrent },
          when: { type: { blueId: ids.text }, value: 'w' },
          then: { type: { blueId: ids.text }, value: 't' },
        },
      ],
      external: { type: { blueId: ids.externalType }, value: 'ext' },
    });

    const json = blue.nodeToJson(node, {
      blueContext: { repositories: { 'repo.blue': repositoryVersions[2] } },
    }) as any;

    expect(json.external.type.blueId).toBeUndefined();
    expect(json.external.type.name).toEqual('ExternalType');
  });

  it('fails for external types when fallback is disabled', () => {
    const blue = createBlueInstance();
    const node = blue.jsonValueToNode({
      type: { blueId: ids.policyCurrent },
      owner: { type: { blueId: ids.text }, value: 'owner' },
      rules: [
        {
          type: { blueId: ids.ruleCurrent },
          when: { type: { blueId: ids.text }, value: 'w' },
          then: { type: { blueId: ids.text }, value: 't' },
        },
      ],
      external: { type: { blueId: ids.externalType }, value: 'ext' },
    });

    expect(() =>
      blue.nodeToJson(node, {
        blueContext: {
          repositories: { 'repo.blue': repositoryVersions[2] },
          fallbackToCurrentInlineDefinitions: false,
        },
      }),
    ).toThrowError(BlueError);
  });

  it('throws on unknown RepoBlueId', () => {
    const blue = createBlueInstance();
    const node = blue.jsonValueToNode({
      type: { blueId: ids.policyCurrent },
    });

    expect(() =>
      blue.nodeToJson(node, {
        blueContext: { repositories: { 'repo.blue': 'R999' } },
      }),
    ).toThrowError(BlueError);
  });

  it('normalizes out-of-order versions before serialization', () => {
    const reorderedRepository = JSON.parse(
      JSON.stringify(repoBlue),
    ) as typeof repoBlue;
    const ruleVersions =
      reorderedRepository.packages.myos.typesMeta[ids.ruleCurrent].versions;
    reorderedRepository.packages.myos.typesMeta[ids.ruleCurrent].versions = [
      ...ruleVersions,
    ].reverse();

    const blue = new Blue({
      repositories: [reorderedRepository, otherRepository],
    });

    const node = blue.jsonValueToNode({
      type: { blueId: ids.policyCurrent },
      rules: [
        {
          type: { blueId: ids.ruleCurrent },
          when: { type: { blueId: ids.text }, value: 'w' },
          then: { type: { blueId: ids.text }, value: 't' },
          severity: { type: { blueId: ids.text }, value: 'high' },
        },
      ],
    });

    const json = blue.nodeToJson(node, {
      blueContext: {
        repositories: { 'repo.blue': repositoryVersions[1] },
      },
    }) as any;

    expect(json.type.blueId).toEqual(ids.policyHistoric);
    const rules =
      (json.rules as { items?: unknown[] })?.items ?? (json.rules as any[]);
    expect(rules[0].type.blueId).toEqual(ids.ruleHistoric);
    expect(rules[0].severity).toBeUndefined();
  });
});
