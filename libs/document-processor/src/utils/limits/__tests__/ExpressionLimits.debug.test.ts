import { Blue } from '@blue-labs/language';
import { ExpressionLimits } from '../ExpressionLimits';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';

describe('ExpressionLimits debug', () => {
  test('understand expression handling without custom processor', () => {
    const blue = new Blue({
      repositories: [coreRepository, myosRepository],
    });
    blue.setGlobalLimits(new ExpressionLimits());

    // Use a simpler test case without type conflict
    const yaml = `
type: Update Document
changeset: "\${steps.CreateSubscriptions.changes}"`;

    const node = blue.yamlToNode(yaml);
    console.log('\n=== Without custom processor ===');
    console.log(
      'Before resolve - changeset value:',
      blue.nodeToJson(node.getProperties()!['changeset']!, 'original')
    );

    const resolved = blue.resolve(node);
    console.log(
      'After resolve - changeset value:',
      blue.nodeToJson(resolved.getProperties()!['changeset']!, 'original')
    );
  });
});
