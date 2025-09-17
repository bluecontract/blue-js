import { Limits } from './Limits';
import { BlueNode } from '../../model';
import { NodeToPathLimitsConverter } from './NodeToPathLimitsConverter';

function javaLikeSplit(input: string, delimiter: string | RegExp): string[] {
  const parts = input.split(delimiter);
  const reversedIndex = [...parts].reverse().findIndex((part) => part !== '');
  const cutoff = reversedIndex === -1 ? 0 : parts.length - reversedIndex;
  return parts.slice(0, cutoff);
}

/**
 * Supported features:
 * 1. Exact path matching (e.g., "/a/b/c")
 * 2. Single-level wildcards (e.g., "/a/*\/c")
 * 3. Maximum depth limitation
 */
export class PathLimits extends Limits {
  private readonly allowedPaths: Set<string>;
  private readonly maxDepth: number;
  private readonly currentPath: string[] = [];

  /**
   * Creates path limits with the specified paths and max depth
   * @param allowedPaths - The paths to limit extension to
   * @param maxDepth - The maximum depth of paths to allow
   */
  constructor(allowedPaths: Set<string>, maxDepth: number) {
    super();
    this.allowedPaths = allowedPaths;
    this.maxDepth = maxDepth;
  }

  /**
   * Determines if a path segment should be extended
   * @param pathSegment - The path segment
   * @returns True if the segment should be extended, false otherwise
   */
  public override shouldExtendPathSegment(pathSegment: string): boolean {
    if (this.currentPath.length >= this.maxDepth) {
      return false;
    }

    const potentialPath = this.normalizePath(
      this.getCurrentFullPath() + '/' + pathSegment
    );

    return this.isAllowedPath(potentialPath);
  }

  /**
   * Determines if a path segment should be merged
   * @param pathSegment - The path segment
   * @returns True if the segment should be merged, false otherwise
   */
  public override shouldMergePathSegment(pathSegment: string): boolean {
    return this.shouldExtendPathSegment(pathSegment);
  }

  /**
   * Checks if a path is allowed
   * @param path - The path to check
   * @returns True if the path is allowed, false otherwise
   */
  private isAllowedPath(path: string): boolean {
    for (const allowedPath of this.allowedPaths) {
      if (this.matchesAllowedPath(allowedPath, path)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if a path matches an allowed path pattern
   * @param allowedPath - The allowed path pattern
   * @param path - The path to check
   * @returns True if the path matches the allowed path pattern, false otherwise
   */
  private matchesAllowedPath(allowedPath: string, path: string): boolean {
    const allowedParts = javaLikeSplit(allowedPath, '/');
    const pathParts = javaLikeSplit(path, '/');

    if (pathParts.length > allowedParts.length) {
      return false;
    }

    for (let i = 1; i < pathParts.length; i++) {
      if (allowedParts[i] !== '*' && allowedParts[i] !== pathParts[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Enters a path segment
   * @param pathSegment - The path segment
   */
  public override enterPathSegment(pathSegment: string): void {
    this.currentPath.push(pathSegment);
  }

  /**
   * Exits a path segment
   */
  public override exitPathSegment(): void {
    if (this.currentPath.length > 0) {
      this.currentPath.pop();
    }
  }

  /**
   * Gets the current full path
   * @returns The current full path
   */
  private getCurrentFullPath(): string {
    return '/' + this.currentPath.join('/');
  }

  /**
   * Normalizes a path
   * @param path - The path to normalize
   * @returns The normalized path
   */
  private normalizePath(path: string): string {
    return (
      '/' +
      path
        .split('/')
        .filter((s) => s !== '')
        .join('/')
    );
  }

  /**
   * Creates path limits with a maximum depth
   * @param maxDepth - The maximum depth
   * @returns The path limits
   */
  public static withMaxDepth(maxDepth: number): PathLimits {
    const builder = new PathLimitsBuilder().setMaxDepth(maxDepth);
    // Add wildcard patterns for each depth level
    for (let i = 1; i <= maxDepth; i++) {
      const pattern = '/' + Array(i).fill('*').join('/');
      builder.addPath(pattern);
    }
    return builder.build();
  }

  /**
   * Creates path limits with a single path
   * @param path - The path to limit extension to
   * @returns The path limits
   */
  public static withSinglePath(path: string): PathLimits {
    return new PathLimitsBuilder().addPath(path).build();
  }

  /**
   * Creates path limits by analyzing the structure of a node.
   * Leaf paths (no properties and no items) are added as allowed paths.
   */
  public static fromNode(node: BlueNode): PathLimits {
    return NodeToPathLimitsConverter.convert(node);
  }
}

/**
 * Builder for PathLimits
 */
export class PathLimitsBuilder {
  private allowedPaths: Set<string> = new Set<string>();
  private maxDepth: number = Number.MAX_SAFE_INTEGER;

  /**
   * Adds a path to the allowed paths
   * @param path - The path to add
   * @returns The builder
   */
  public addPath(path: string): PathLimitsBuilder {
    this.allowedPaths.add(path);
    return this;
  }

  /**
   * Sets the maximum depth
   * @param maxDepth - The maximum depth
   * @returns The builder
   */
  public setMaxDepth(maxDepth: number): PathLimitsBuilder {
    this.maxDepth = maxDepth;
    return this;
  }

  /**
   * Builds the PathLimits
   * @returns The built PathLimits
   */
  public build(): PathLimits {
    return new PathLimits(this.allowedPaths, this.maxDepth);
  }
}
