import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import { expr } from '../expr.js';

describe('sdk generation: anchors, links, and grants', () => {
  it('wraps anchors and links as MyOS marker contracts', () => {
    const yaml = DocBuilder.doc()
      .name('Anchors and links')
      .documentAnchors({
        bySession: {
          type: 'MyOS/Document Anchor',
          sourcePath: '/targetSessionId',
        },
      })
      .documentLinks({
        primarySession: {
          type: 'MyOS/MyOS Session Link',
          targetSessionId: expr("document('/targetSessionId')"),
        },
      })
      .toYaml();

    expect(yaml.trim()).toBe(
      `
name: Anchors and links
contracts:
  documentAnchors:
    type: MyOS/Document Anchors
    bySession:
      type: MyOS/Document Anchor
      sourcePath: /targetSessionId
  documentLinks:
    type: MyOS/Document Links
    primarySession:
      type: MyOS/MyOS Session Link
      targetSessionId: \${document('/targetSessionId')}
`.trim(),
    );
  });
});
