import { NodeProvider } from '../NodeProvider';
import { BlueNode, NodeDeserializer } from '../model';
import { NodeContentHandler } from './NodeContentHandler';
import { JsonBlueValue } from '../../schema';

export abstract class AbstractNodeProvider extends NodeProvider {
  /**
   * Fetches raw content by Blue ID
   * @param baseBlueId - The base Blue ID (without # suffix)
   * @returns The raw content as JSON-like object, or null if not found
   */
  protected abstract fetchContentByBlueId(
    baseBlueId: string,
  ): JsonBlueValue | null;

  override fetchByBlueId(blueId: string): BlueNode[] | null {
    const baseBlueId = blueId.split('#')[0];
    const content = this.fetchContentByBlueId(baseBlueId);

    if (content === null || content === undefined) {
      return null;
    }

    const isMultipleDocuments = Array.isArray(content) && content.length > 1;
    const resolvedContent = NodeContentHandler.resolveThisReferences(
      content,
      baseBlueId,
      isMultipleDocuments,
    );

    if (blueId.includes('#')) {
      const parts = blueId.split('#');
      if (parts.length > 1) {
        const index = parseInt(parts[1]);
        if (Array.isArray(resolvedContent) && index < resolvedContent.length) {
          const item = resolvedContent[index];
          const node = NodeDeserializer.deserialize(item);

          node.setBlueId(blueId);
          return [node];
        } else if (index === 0) {
          const node = NodeDeserializer.deserialize(resolvedContent);
          node.setBlueId(blueId);
          return [node];
        } else {
          return null;
        }
      }
    }

    if (Array.isArray(resolvedContent)) {
      return resolvedContent.map((item) => {
        const node = NodeDeserializer.deserialize(item);
        return node;
      });
    } else {
      const node = NodeDeserializer.deserialize(resolvedContent);
      node.setBlueId(baseBlueId);
      return [node];
    }
  }
}
