import { isNumberString } from './isNumberString';

export const isPreciseNumberString = (value: string) => {
  if (isNumberString(value)) {
    const numberValue = Number(value);
    const stringValue = numberValue.toString();
    return stringValue === value;
  }
  return false;
};
