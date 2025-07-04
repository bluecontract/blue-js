import { isNonNullable } from '@blue-labs/shared-utils';
import { z, ZodTypeAny } from 'zod';
import { setAnnotations, getAnnotations } from './annotations';
import { BlueNode } from '../../lib/model/Node';

export const withBlueNode =
  () =>
  <Schema extends ZodTypeAny = ZodTypeAny>(schema: Schema) => {
    const annotations = getAnnotations(schema);

    return setAnnotations(schema, {
      ...annotations,
      blueNode: true,
    });
  };

export const getBlueNodeAnnotation = (schema: ZodTypeAny) => {
  const annotations = getAnnotations(schema);
  if (
    isNonNullable(annotations) &&
    isNonNullable(annotations.blueNode) &&
    annotations.blueNode === true
  ) {
    return annotations.blueNode;
  }
  return null;
};

export const isBlueNodeSchema = (schema: ZodTypeAny) => {
  return !!getBlueNodeAnnotation(schema);
};

export const blueNodeField = () => {
  const blueNodeFieldSchema = z.instanceof(BlueNode);
  return withBlueNode()(blueNodeFieldSchema);
};
