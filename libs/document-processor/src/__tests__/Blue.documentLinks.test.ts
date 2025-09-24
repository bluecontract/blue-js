import { describe, it, expect } from 'vitest';
import { Blue } from '@blue-labs/language';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';

describe('blue.resolve with Document Links and Document Link values', () => {
  const blue = new Blue({ repositories: [coreRepository, myosRepository] });
  it('resolves Document Links dictionaries', () => {
    const doc = {
      contracts: {
        links: {
          type: 'Document Links',
          link1: {
            type: 'Document Link',
            anchor: 'anchorA',
            documentId: 'doc-123',
          },
        },
      },
    };

    const node = blue.jsonValueToNode(doc);
    expect(node).toBeTruthy();

    const resolved = blue.resolve(node);
    expect(resolved).toBeTruthy();

    const contracts = resolved.getContracts();
    expect(contracts).toBeDefined();

    const linksNode = contracts?.links;
    expect(linksNode?.getValueType()?.getName()).toBe('Link');

    const link1 = linksNode?.getProperties()?.link1;
    expect(link1?.getType()?.getName()).toBe('Document Link');
    expect(link1?.getProperties()?.anchor?.getValue()).toBe('anchorA');
    expect(link1?.getProperties()?.documentId?.getValue()).toBe('doc-123');
  });
});
