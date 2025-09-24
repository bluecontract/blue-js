import { describe, it, expect } from 'vitest';
import { Blue } from '../Blue';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';
import type { BlueRepository } from '../types/BlueRepository';
import { RepositoryBasedNodeProvider } from '../provider';

describe('blue.resolve with Document Links and Document Link values', () => {
  it('resolves Document Link dictionary entries', () => {
    // Build repository contents with proper BlueId references to avoid inline type validation errors
    const linkDef = {
      name: 'Link',
      description: 'Abstract base class for all link types.',
      anchor: {
        type: 'Text',
        description: 'Target anchor key on the destination document.',
      },
    } as const;
    const blue = new Blue();

    const linkNode = blue.jsonValueToNode(linkDef);
    const linkBlueId = BlueIdCalculator.calculateBlueIdSync(linkNode);

    blue.registerBlueIds({ Link: linkBlueId });

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

    const documentLinkNode = blue.jsonValueToNode(documentLinkDef);
    const documentLinkBlueId =
      BlueIdCalculator.calculateBlueIdSync(documentLinkNode);

    blue.registerBlueIds({ 'Document Link': documentLinkBlueId });

    const documentLinksDef = {
      name: 'Document Links',
      description:
        'Dictionary of named outgoing connections from this document to anchors on other documents or sessions. MyOS indexes supported link variants to power discovery.',
      type: 'Dictionary',
      keyType: 'Text',
      valueType: 'Link',
    } as const;
    const documentLinksNode = blue.jsonValueToNode(documentLinksDef);
    const documentLinksBlueId =
      BlueIdCalculator.calculateBlueIdSync(documentLinksNode);

    blue.registerBlueIds({ 'Document Links': documentLinksBlueId });

    const repository: BlueRepository = {
      blueIds: {
        Link: linkBlueId,
        'Document Link': documentLinkBlueId,
        'Document Links': documentLinksBlueId,
      },
      schemas: [],
      contents: {
        [linkBlueId]: blue.nodeToJson(linkNode),
        [documentLinkBlueId]: blue.nodeToJson(documentLinkNode),
        [documentLinksBlueId]: blue.nodeToJson(documentLinksNode),
      },
    };

    blue.setNodeProvider(new RepositoryBasedNodeProvider([repository]));

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
