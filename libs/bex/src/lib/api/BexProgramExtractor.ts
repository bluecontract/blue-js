import {
  nodeToSimple,
  type BexReadableNode,
  type BexSimple,
} from '../value/BexValues';
import type { BexProgramInputKind } from './BexProgramSource';

export interface BexProgramExtractorOptions {
  readonly inputKind?: BexProgramInputKind;
}

export class BexProgramExtractor {
  public static extract(
    node: BexReadableNode,
    options: BexProgramExtractorOptions = {},
  ): BexSimple {
    const inputKind = options.inputKind ?? 'source';
    return nodeToSimple(node, {
      includeMetadata: (path) =>
        inputKind === 'resolved' ? !isBexNameContainer(path) : true,
    });
  }
}

function isBexNameContainer(path: readonly string[]): boolean {
  const last = path[path.length - 1];
  const parent = path[path.length - 2];
  const grandparent = path[path.length - 3];

  return (
    last === 'functions' ||
    last === 'constants' ||
    (last === 'args' && parent === '$call') ||
    (last === 'args' && grandparent === 'functions')
  );
}
