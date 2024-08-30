export const getBlueObjectItems = <TItem>(value?: {
  items?: TItem[];
}): TItem[] | undefined => value?.items;

export const getBlueObjectValue = <TItem>(value?: {
  value?: TItem;
}): TItem | undefined => value?.value;
