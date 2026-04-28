import { describe, it, expect } from 'vitest';
import { Blue } from '../Blue';
import { BasicNodeProvider } from '../provider';

describe('blue.resolve with Document Links and Document Link values', () => {
  it('resolves Document Link dictionary entries', () => {
    const provider = new BasicNodeProvider();
    const blue = new Blue({ nodeProvider: provider });
    const registerType = (name: string, definition: object) => {
      const node = blue.jsonValueToNode(definition);
      provider.addSingleNodes(node);
      const blueId = provider.getBlueIdByName(name);
      blue.registerBlueIds({ [name]: blueId });
      return blueId;
    };

    const linkDef = {
      name: 'Link',
      description: 'Abstract base class for all link types.',
      anchor: {
        type: 'Text',
        description: 'Target anchor key on the destination document.',
      },
    } as const;
    registerType('Link', linkDef);

    const documentLinkDef = {
      name: 'Document Link',
      type: 'Link',
      description:
        'Link targeting a specific Blue document by its stable documentId (initial blueId before any processing). Used to point to a logical document regardless of session.',
      documentId: {
        type: 'Text',
        description:
          'Stable document identifier (original BlueId) of the target document.',
      },
    } as const;

    registerType('Document Link', documentLinkDef);

    const documentLinksDef = {
      name: 'Document Links',
      description:
        'Dictionary of named outgoing connections from this document to anchors on other documents or sessions. MyOS indexes supported link variants to power discovery.',
      type: 'Dictionary',
      keyType: 'Text',
      valueType: 'Link',
    } as const;
    registerType('Document Links', documentLinksDef);

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
    expect(link1?.getProperties()?.documentId?.getValue()).toBe('doc-123');
  });
});
