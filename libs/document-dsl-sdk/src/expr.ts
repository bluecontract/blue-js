export const expr = (expression: string): string => {
  if (expression.startsWith('${') && expression.endsWith('}')) {
    return expression;
  }
  return `\${${expression}}`;
};
