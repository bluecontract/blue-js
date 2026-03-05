import { BasicBlueTypes } from './basic-blue-types.js';

type TypeLikeObject = {
  readonly name: string;
};

export type TypeLike = string | TypeLikeObject;

export function toTypeAlias(typeLike: TypeLike): string {
  if (typeof typeLike === 'string') {
    return typeLike.trim();
  }
  const name = typeLike.name?.trim();
  if (!name) {
    throw new Error('Cannot resolve type alias from unnamed constructor');
  }
  switch (name) {
    case 'String':
      return BasicBlueTypes.Text;
    case 'Number':
      return BasicBlueTypes.Integer;
    case 'Boolean':
      return BasicBlueTypes.Boolean;
    case 'Array':
      return BasicBlueTypes.List;
    case 'Object':
      return BasicBlueTypes.Dictionary;
    default:
      return name;
  }
}
