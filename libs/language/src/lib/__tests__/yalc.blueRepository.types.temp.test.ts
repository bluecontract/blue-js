import { describe, expect, it } from 'vitest';
import { Blue } from '../Blue';
import repository from '@blue-repository/types';
import { BOOLEAN_TYPE_BLUE_ID } from '../utils/Properties';

describe('yalc @blue-repository/types integration (temp)', () => {
  it('serializes latest vs first repo version for Agent.llmEnabled', () => {
    const blue = new Blue({ repositories: [repository as any] });

    const agentCurrentId = repository.packages.myos.aliases['MyOS/Agent'];
    const agentV0Id =
      repository.packages.myos.typesMeta[agentCurrentId].versions[0].typeBlueId;

    const doc = blue.yamlToNode(`type: MyOS/Agent\nllmEnabled: true\n`);

    expect(blue.nodeToJson(doc)).toEqual({
      type: { blueId: agentCurrentId },
      llmEnabled: { type: { blueId: BOOLEAN_TYPE_BLUE_ID }, value: true },
    });

    expect(
      blue.nodeToJson(doc, {
        blueContext: {
          repositories: {
            [repository.name]: repository.repositoryVersions[0],
          },
        },
      }),
    ).toEqual({
      type: { blueId: agentV0Id },
    });
  });

  it('serializes dev type latest and inlines it when negotiating to first repo version', () => {
    const blue = new Blue({ repositories: [repository as any] });

    const agentCurrentId = repository.packages.myos.aliases['MyOS/Agent'];
    const agentV0Id =
      repository.packages.myos.typesMeta[agentCurrentId].versions[0].typeBlueId;

    const agentLlmId = repository.packages.myos.aliases['MyOS/Agent LLM'];

    const doc = blue.yamlToNode(`type: MyOS/Agent LLM\nllmEnabled: true\n`);

    expect(blue.nodeToJson(doc)).toEqual({
      type: { blueId: agentLlmId },
      llmEnabled: { type: { blueId: BOOLEAN_TYPE_BLUE_ID }, value: true },
    });

    expect(
      blue.nodeToJson(doc, {
        blueContext: {
          repositories: {
            [repository.name]: repository.repositoryVersions[0],
          },
        },
      }),
    ).toEqual({
      type: {
        name: 'Agent LLM',
        type: { blueId: agentV0Id },
        description:
          'Marker type for a specialized Blue document that MyOS treats as an LLM enabled Agent, enabling richer UI and behaviors while remaining a standard Blue document.',
      },
      llmEnabled: { type: { blueId: BOOLEAN_TYPE_BLUE_ID }, value: true },
    });
  });
});
