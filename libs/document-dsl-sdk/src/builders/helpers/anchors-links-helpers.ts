import { createOrderedObject } from '../../internal/order.js';
import type { BlueContract } from '../../types.js';

export const createDocumentAnchorsContract = (
  anchors: Record<string, BlueContract>,
): BlueContract =>
  createOrderedObject([
    ['type', 'MyOS/Document Anchors'],
    ...Object.entries(anchors),
  ]);

export const createDocumentLinksContract = (
  links: Record<string, BlueContract>,
): BlueContract =>
  createOrderedObject([
    ['type', 'MyOS/Document Links'],
    ...Object.entries(links),
  ]);
