export const isNumberString = (value: string) => {
  return !isNaN(Number(value)) && isFinite(Number(value));
};
