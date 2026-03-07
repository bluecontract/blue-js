/**
 * Java reference:
 * - references/java-sdk/src/main/java/blue/language/sdk/DocBuilder.java
 */
import { BlueNode } from '@blue-labs/language';

import {
  getNodeAtPointer,
  removeNodeAtPointer,
  setNodeAtPointer,
} from '../internal/pointer.js';

describe('pointer helpers', () => {
  it('writes nested object values', () => {
    const root = new BlueNode();

    setNodeAtPointer(root, '/profile/name', new BlueNode().setValue('Alice'));

    expect(getNodeAtPointer(root, '/profile/name')?.getValue()).toBe('Alice');
  });

  it('creates array containers when numeric segments are used', () => {
    const root = new BlueNode();

    setNodeAtPointer(root, '/items/0/name', new BlueNode().setValue('First'));

    expect(getNodeAtPointer(root, '/items/0/name')?.getValue()).toBe('First');
  });

  it('removes existing nodes and ignores missing paths', () => {
    const root = new BlueNode();
    setNodeAtPointer(root, '/status', new BlueNode().setValue('ready'));

    removeNodeAtPointer(root, '/status');
    removeNodeAtPointer(root, '/status');

    expect(getNodeAtPointer(root, '/status')).toBeUndefined();
  });

  it('rejects root writes and removals', () => {
    const root = new BlueNode();

    expect(() => setNodeAtPointer(root, '/', new BlueNode())).toThrow(
      'pointer cannot target the document root.',
    );
    expect(() => removeNodeAtPointer(root, '/')).toThrow(
      'pointer cannot target the document root.',
    );
  });
});
