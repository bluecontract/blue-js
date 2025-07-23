const EXPRESSION_REGEX = /^\$\{(.*)\}$/;

/**
 * Checks if a value is an expression (starts with "${" and ends with "}")
 * @param value - The value to check
 * @returns True if the value is an expression, false otherwise
 */
export const isExpression = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }
  return EXPRESSION_REGEX.test(value);
};

/**
 * Extracts the expression content from an expression string
 * @param expression - The expression string (e.g., "${some.expression}")
 * @returns The expression content without the wrapping syntax (e.g., "some.expression")
 * @throws Error if the value is not a valid expression
 */
export const extractExpressionContent = (expression: string): string => {
  if (!isExpression(expression)) {
    throw new Error(`Invalid expression: ${expression}`);
  }
  return expression.slice(2, -1);
};
