export function wrapExpression(expression: string): string {
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    throw new Error('Expression cannot be empty.');
  }
  if (trimmed.startsWith('${') && trimmed.endsWith('}')) {
    return trimmed;
  }
  return `\${${trimmed}}`;
}
