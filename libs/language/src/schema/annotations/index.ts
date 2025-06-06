// Re-export all annotations functionality from schema-annotations
export * from '@blue-company/schema-annotations';

// Export BlueNode-specific functionality (this will override the generic blueNodeField)
export {
  withBlueNode,
  getBlueNodeAnnotation,
  isBlueNodeSchema,
  blueNodeField, // This BlueNode-specific version overrides the generic one
} from './blueNode';
