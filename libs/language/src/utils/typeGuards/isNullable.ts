export const isNullable = <T>(
  input: null | undefined | T
): input is null | undefined => input === null || input === undefined;
