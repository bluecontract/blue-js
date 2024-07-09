export const isNonNullable = <T>(input: null | undefined | T): input is T => {
  return input !== null && input !== undefined;
};
