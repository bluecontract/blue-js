import * as ts from 'typescript';
import {
  TSBlueMethodParameterMetadata,
  TS_BLUE_METHOD_PARAMETERS_KEY,
  TS_BLUE_METHOD_API_CLIENT_CLASS_NAME_KEY,
  BLUE_AGENT_CLIENT_KEY,
} from '../api/decorators';
import { hasDecorator } from './hasDecorator';

type MethodMetadata = {
  className: string;
  methodName: string;
  params: TSBlueMethodParameterMetadata[];
};

function createParameterNamesTransformer(): ts.TransformerFactory<ts.SourceFile> {
  return (context) => {
    const classNameMethodsMetadata = new Map<string, MethodMetadata[]>();

    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isClassDeclaration(node) && node.name) {
        // Only process if the class has @BlueAgentClient decorator
        if (!hasDecorator(node, BLUE_AGENT_CLIENT_KEY.toString())) {
          return node;
        }

        const className = node.name.text;
        const methodsMetadata: MethodMetadata[] = [];

        // Collect information from the class’s methods
        node.members.forEach((member) => {
          if (
            ts.isMethodDeclaration(member) &&
            member.name &&
            ts.isIdentifier(member.name)
          ) {
            const methodName = member.name.text;
            const params = member.parameters.map((param, index) => {
              const isOptional = !!param.questionToken || !!param.initializer;
              const paramName = ts.isIdentifier(param.name)
                ? param.name.text
                : `param${index}`;
              return { name: paramName, index, isOptional };
            });

            methodsMetadata.push({ className, methodName, params });
          }
        });

        // Store collected metadata for this class for later insertion
        classNameMethodsMetadata.set(className, methodsMetadata);

        return node;
      }

      return ts.visitEachChild(node, visit, context);
    }

    function addMetadataCalls(sourceFile: ts.SourceFile): ts.SourceFile {
      const newStatements: ts.Statement[] = [...sourceFile.statements];

      // For each class we processed, insert metadata after its definition
      for (let i = 0; i < newStatements.length; i++) {
        const stmt = newStatements[i];
        if (
          ts.isClassDeclaration(stmt) &&
          stmt.name &&
          classNameMethodsMetadata.has(stmt.name.text)
        ) {
          const className = stmt.name.text;
          const methodsMetadata = classNameMethodsMetadata.get(className) ?? [];

          // Create an expression for storing original class name:
          const originalNameMetadataCall = ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier('Reflect'),
                'defineMetadata'
              ),
              undefined,
              [
                ts.factory.createStringLiteral(
                  TS_BLUE_METHOD_API_CLIENT_CLASS_NAME_KEY
                ),
                ts.factory.createStringLiteral(className),
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier(className),
                  'constructor'
                ),
              ]
            )
          );

          // Create Reflect.defineMetadata calls for each method
          const metadataStatements = methodsMetadata.map(
            ({ methodName, params }) => {
              const paramInfoArray = ts.factory.createArrayLiteralExpression(
                params.map(({ name, index, isOptional }) =>
                  ts.factory.createObjectLiteralExpression(
                    [
                      ts.factory.createPropertyAssignment(
                        'index',
                        ts.factory.createNumericLiteral(index)
                      ),
                      ts.factory.createPropertyAssignment(
                        'name',
                        ts.factory.createStringLiteral(name)
                      ),
                      ts.factory.createPropertyAssignment(
                        'isOptional',
                        isOptional
                          ? ts.factory.createTrue()
                          : ts.factory.createFalse()
                      ),
                    ],
                    true
                  )
                )
              );

              return ts.factory.createExpressionStatement(
                ts.factory.createCallExpression(
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier('Reflect'),
                    'defineMetadata'
                  ),
                  undefined,
                  [
                    ts.factory.createStringLiteral(
                      TS_BLUE_METHOD_PARAMETERS_KEY
                    ),
                    paramInfoArray,
                    ts.factory.createPropertyAccessExpression(
                      ts.factory.createIdentifier(className),
                      'prototype'
                    ),
                    ts.factory.createStringLiteral(methodName),
                  ]
                )
              );
            }
          );

          // Insert these metadata statements right after the class declaration
          newStatements.splice(
            i + 1,
            0,
            originalNameMetadataCall,
            ...metadataStatements
          );

          // Advance the index past the newly inserted statements
          i += metadataStatements.length;
        }
      }

      return ts.factory.updateSourceFile(sourceFile, newStatements);
    }

    return (file: ts.SourceFile) => {
      const visited = ts.visitNode(file, visit);
      return addMetadataCalls(visited as ts.SourceFile);
    };
  };
}

export default createParameterNamesTransformer;
