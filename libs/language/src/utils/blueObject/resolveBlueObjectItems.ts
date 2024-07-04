import { map } from 'radash';
import { BlueId, BlueObject, BlueObjectWithId } from '../../schema';
import { enrichWithBlueId } from './enrichWithBlueId';
import { isBlueObjectResolved } from './isBlueObjectResolved';

export type ResolveBlueObjectItemsOptions = {
  items: BlueObject[];
  /**
   * The number of items to resolve at a time, or all items if undefined
   */
  count?: number;
  /**
   * The function to resolve the items of a BlueObject
   */
  resolveFunction: (
    blueObject: BlueObjectWithId,
    context: { signal: AbortSignal }
  ) => Promise<BlueObject[] | BlueObject>;
  signal?: AbortSignal;
  /**
   * defines the blueId's of items that should be omitted from the resolved items
   */
  omitItems?: BlueId[];
};

/**
 * @returns The resolved and flattened items of a BlueObject
 */
export const resolveBlueObjectItems = async (
  options: ResolveBlueObjectItemsOptions
): Promise<BlueObjectWithId[]> => {
  const {
    resolveFunction,
    signal = new AbortController().signal,
    omitItems,
  } = options;

  const count = options.count ?? options.items.length;

  let items = await map(options.items, async (item) => {
    return await enrichWithBlueId(item);
  });

  const endIndex = Math.max(items?.length - count, 0);
  for (let i = items.length - 1; i >= endIndex; i--) {
    if (!isBlueObjectResolved(items[i])) {
      const resolvedItems = await resolveFunction(items[i], { signal });

      if (Array.isArray(resolvedItems)) {
        return resolveBlueObjectItems({
          ...options,
          items: [
            ...items.slice(0, i),
            ...resolvedItems,
            ...items.slice(i + 1),
          ],
        });
      }
      const enrichedResolvedItem = await enrichWithBlueId(resolvedItems);
      if (omitItems?.includes(enrichedResolvedItem.blueId)) {
        return resolveBlueObjectItems({
          ...options,
          items: [...items.slice(0, i), ...items.slice(i + 1)],
        });
      }

      items = [
        ...items.slice(0, i),
        enrichedResolvedItem,
        ...items.slice(i + 1),
      ];
    }
  }

  return items;
};
