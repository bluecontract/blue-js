import * as ts from 'typescript';

export function hasDecorator(
  node: ts.ClassDeclaration,
  decoratorName: string
): boolean {
  // node.modifiers may contain both Decorators and Modifiers (like 'export', 'abstract').
  // We need to filter out which ones are actually Decorators.
  const decorators = node.modifiers?.filter<ts.Decorator>(
    (m) => m.kind === ts.SyntaxKind.Decorator
  );

  if (!decorators) {
    return false;
  }

  for (const decorator of decorators) {
    const expr = decorator.expression;
    if (ts.isIdentifier(expr) && expr.text === decoratorName) {
      return true;
    } else if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
      if (expr.expression.text === decoratorName) {
        return true;
      }
    }
  }

  return false;
}
