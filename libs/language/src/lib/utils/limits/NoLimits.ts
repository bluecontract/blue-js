import { Limits } from './Limits';

/**
 * Implementation of Limits that imposes no limits on node extension
 */
export class NoLimits extends Limits {
  /**
   * Determines if a path segment should be extended - always returns true
   * @returns Always true
   */
  public shouldExtendPathSegment() {
    return true;
  }

  /**
   * Determines if a path segment should be merged - always returns true
   * @returns Always true
   */
  public shouldMergePathSegment() {
    return true;
  }

  /**
   * Enters a path segment - no-op
   */
  public override enterPathSegment() {
    // No-op
  }

  /**
   * Exits a path segment - no-op
   */
  public exitPathSegment() {
    // No-op
  }
}
