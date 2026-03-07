export function wrapExpression(expression: string): string {
  const trimmed = expression.trim();
  return trimmed.startsWith('${') ? trimmed : `\${${trimmed}}`;
}

export function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0;
}
