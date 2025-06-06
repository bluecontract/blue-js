import { z } from 'zod';
import { withBlueNode } from '@blue-company/schema-annotations';
import { BlueNode } from '../../lib/model/Node';

// Export the generic annotation functions
export {
  withBlueNode,
  getBlueNodeAnnotation,
  isBlueNodeSchema,
} from '@blue-company/schema-annotations';

// Provide a BlueNode-specific version of blueNodeField
export const blueNodeField = () => {
  const blueNodeFieldSchema = z.instanceof(BlueNode);
  return withBlueNode()(blueNodeFieldSchema);
};
