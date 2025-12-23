import { describe, expect, it } from 'vitest';
import type { NodeToJsonOptions } from '../../types/BlueContext';
import { createBlueInstance, ids, repositoryVersions } from './fixtures';

describe('Repository versioning: negotiated serialization', () => {
  const blueContextFor = (repoBlueId: string): NodeToJsonOptions => ({
    blueContext: {
      repositories: { 'repo.blue': repoBlueId },
    },
    format: 'official',
  });

  const policyInstanceJson = {
    type: { blueId: ids.policyCurrent },
    owner: { type: { blueId: ids.text }, value: 'alice' },
    rules: [
      {
        type: { blueId: ids.ruleCurrent },
        when: { type: { blueId: ids.text }, value: 'w1' },
        then: { type: { blueId: ids.text }, value: 't1' },
        severity: { type: { blueId: ids.text }, value: 'high' },
        metadata: {
          notes: { type: { blueId: ids.text }, value: 'rule-notes-1' },
          flags: { type: { blueId: ids.text }, value: 'rule-flags-1' },
        },
      },
      {
        type: { blueId: ids.ruleCurrent },
        when: { type: { blueId: ids.text }, value: 'w2' },
        then: { type: { blueId: ids.text }, value: 't2' },
        severity: { type: { blueId: ids.text }, value: 'low' },
        metadata: {
          notes: { type: { blueId: ids.text }, value: 'rule-notes-2' },
          flags: { type: { blueId: ids.text }, value: 'rule-flags-2' },
        },
      },
    ],
    audit: {
      type: { blueId: ids.auditInfo },
      notes: { type: { blueId: ids.text }, value: 'audit' },
    },
    metadata: {
      nested: { type: { blueId: ids.text }, value: 'keep' },
    },
    other: {
      metadata: {
        flags: { type: { blueId: ids.text }, value: 'keep-me' },
        notes: { type: { blueId: ids.text }, value: 'keep-notes' },
      },
    },
    untypedRules: {
      itemType: { blueId: ids.ruleCurrent },
      items: [
        {
          when: { type: { blueId: ids.text }, value: 'w1' },
          then: { type: { blueId: ids.text }, value: 't1' },
          severity: { type: { blueId: ids.text }, value: 'high' },
          metadata: {
            notes: { type: { blueId: ids.text }, value: 'rule-notes-1' },
            flags: { type: { blueId: ids.text }, value: 'rule-flags-1' },
          },
        },
        {
          when: { type: { blueId: ids.text }, value: 'w2' },
          then: { type: { blueId: ids.text }, value: 't2' },
          severity: { type: { blueId: ids.text }, value: 'low' },
          metadata: {
            notes: { type: { blueId: ids.text }, value: 'rule-notes-2' },
            flags: { type: { blueId: ids.text }, value: 'rule-flags-2' },
          },
        },
      ],
    },
    untypedMap: {
      valueType: { blueId: ids.ruleCurrent },
      first: {
        when: { type: { blueId: ids.text }, value: 'wf' },
        then: { type: { blueId: ids.text }, value: 'tf' },
        severity: { type: { blueId: ids.text }, value: 'sf' },
        metadata: {
          notes: { type: { blueId: ids.text }, value: 'map-notes-1' },
          flags: { type: { blueId: ids.text }, value: 'map-flags-1' },
        },
      },
      second: {
        when: { type: { blueId: ids.text }, value: 'ws' },
        then: { type: { blueId: ids.text }, value: 'ts' },
        severity: { type: { blueId: ids.text }, value: 'ss' },
        metadata: {
          notes: { type: { blueId: ids.text }, value: 'map-notes-2' },
          flags: { type: { blueId: ids.text }, value: 'map-flags-2' },
        },
      },
    },
  };

  it('keeps current fields and ids at latest version', () => {
    const blue = createBlueInstance();
    const json = blue.nodeToJson(
      blue.jsonValueToNode(policyInstanceJson),
      blueContextFor(repositoryVersions[3]),
    ) as Record<string, unknown>;

    expect(json['audit']).toBeTruthy();
    const rules = (json['rules'] as { items?: unknown[] })?.items;
    const rule = Array.isArray(rules)
      ? (rules[0] as Record<string, unknown>)
      : undefined;
    expect((rule?.type as { blueId: string }).blueId).toEqual(ids.ruleCurrent);
  });

  it('drops fields added after target version and maps BlueIds (R2)', () => {
    const blue = createBlueInstance();
    const json = blue.nodeToJson(
      blue.jsonValueToNode(policyInstanceJson),
      blueContextFor(repositoryVersions[2]),
    ) as Record<string, any>;

    expect(json.audit).toBeUndefined();
    const rules =
      (json.rules as { items?: unknown[] })?.items ?? (json.rules as any[]);
    const rule = Array.isArray(rules) ? rules[0] : undefined;
    expect(rule?.severity).toBeDefined();
    expect(rule?.type.blueId).toEqual(ids.ruleCurrent);
    expect(rule?.metadata?.flags).toBeDefined();
    expect(rule?.metadata?.notes).toBeDefined();
    expect(json.type.blueId).toEqual(ids.policyHistoric);

    const untypedRules = json.untypedRules as any;
    expect(untypedRules.itemType.blueId).toEqual(ids.ruleCurrent);
    expect(untypedRules.items?.[0]?.severity).toBeDefined();
    expect(untypedRules.items?.[1]?.severity).toBeDefined();
    expect(untypedRules.items?.[0]?.metadata?.flags).toBeDefined();
    expect(untypedRules.items?.[1]?.metadata?.flags).toBeDefined();
    expect(untypedRules.items?.[0]?.metadata?.notes).toBeDefined();
    expect(untypedRules.items?.[1]?.metadata?.notes).toBeDefined();

    const untypedMap = json.untypedMap as any;
    expect(untypedMap.valueType.blueId).toEqual(ids.ruleCurrent);
    expect(untypedMap.first.severity).toBeDefined();
    expect(untypedMap.first.metadata.flags).toBeDefined();
    expect(untypedMap.first.metadata.notes).toBeDefined();

    expect((json.other as any)?.metadata?.flags?.value).toEqual('keep-me');
    expect((json.other as any)?.metadata?.notes?.value).toEqual('keep-notes');
  });

  it('drops later fields deeply for older versions (R1)', () => {
    const blue = createBlueInstance();
    const json = blue.nodeToJson(
      blue.jsonValueToNode(policyInstanceJson),
      blueContextFor(repositoryVersions[1]),
    ) as Record<string, any>;

    expect(json.audit).toBeUndefined();
    const rules =
      (json.rules as { items?: unknown[] })?.items ?? (json.rules as any[]);
    expect(rules[0].severity).toBeUndefined();
    expect(rules[1].severity).toBeUndefined();
    expect(json.type.blueId).toEqual(ids.policyHistoric);
    expect(rules[0].type.blueId).toEqual(ids.ruleHistoric);
    expect(rules[0].metadata.flags).toBeUndefined();
    expect(rules[0].metadata.notes).toBeDefined();

    const untypedRules = json.untypedRules as any;
    expect(untypedRules.itemType.blueId).toEqual(ids.ruleHistoric);
    expect(untypedRules.items?.[0]?.severity).toBeUndefined();
    expect(untypedRules.items?.[1]?.severity).toBeUndefined();
    expect(untypedRules.items?.[0]?.metadata?.flags).toBeUndefined();
    expect(untypedRules.items?.[1]?.metadata?.flags).toBeUndefined();
    expect(untypedRules.items?.[0]?.metadata?.notes).toBeDefined();
    expect(untypedRules.items?.[1]?.metadata?.notes).toBeDefined();

    const untypedMap = json.untypedMap as any;
    expect(untypedMap.valueType.blueId).toEqual(ids.ruleHistoric);
    expect(untypedMap.first.severity).toBeUndefined();
    expect(untypedMap.second.severity).toBeUndefined();
    expect(untypedMap.first.metadata.flags).toBeUndefined();
    expect(untypedMap.second.metadata.flags).toBeUndefined();
    expect(untypedMap.first.metadata.notes).toBeDefined();

    expect((json.other as any)?.metadata?.flags?.value).toEqual('keep-me');
    expect((json.other as any)?.metadata?.notes?.value).toEqual('keep-notes');
  });
});
