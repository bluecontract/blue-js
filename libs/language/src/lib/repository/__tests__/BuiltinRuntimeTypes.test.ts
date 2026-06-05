import { describe, expect, it } from 'vitest';
import { BUILTIN_RUNTIME_TYPE_CONTENT_BY_BLUE_ID } from '../BuiltinRuntimeTypes';

const contents: Record<string, unknown> =
  BUILTIN_RUNTIME_TYPE_CONTENT_BY_BLUE_ID;

function readPath(root: unknown, path: string): unknown {
  return path
    .split('/')
    .filter(Boolean)
    .reduce((value, segment) => {
      expect(value).toBeTypeOf('object');
      expect(value).not.toBeNull();
      return (value as Record<string, unknown>)[segment];
    }, root);
}

describe('BUILTIN_RUNTIME_TYPES_REPOSITORY', () => {
  it('uses reference nodes for type-position collection descriptors', () => {
    const expectedReferences = [
      {
        typeBlueId: 'AMtAXPmvumgz1GxKUU9uv3ncXiKMENvqq8AaLvD5LXhv',
        path: '/patches/itemType',
        blueId: '61W96XosAp3DrEC7PuqLYtmF2A6ETpqH6qF2DgYwDq4c',
      },
      {
        typeBlueId: '8FVc8MPz6DcTMgcY3RXU6EBpGa9arWPJ141K2H86yi8Q',
        path: '/paths/itemType',
        blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC',
      },
      {
        typeBlueId: '9GEC24YbFG9hj4banjYh2oEnDpAob1wAPmhjuykJp8T1',
        path: '/lastEvents/keyType',
        blueId: 'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC',
      },
      {
        typeBlueId: 'Fbenow6tanFHkWzKiDD8fGxminQswQ1FecMRakaCx2WX',
        path: '/rules/itemType',
        blueId: '7Vnmk8StjwY7e9mBNpACrn8oh3KZ7yQBjnXe5bLDWn4D',
      },
    ];

    for (const { typeBlueId, path, blueId } of expectedReferences) {
      expect(readPath(contents[typeBlueId], path)).toEqual({ blueId });
    }
  });
});
