export class UnsupportedFeatureError extends Error {
  public readonly code = 'UNSUPPORTED_FEATURE';
  public readonly feature: 'this#' | '$pos' | '$previous';
  public readonly locationPath: string;

  constructor(
    feature: 'this#' | '$pos' | '$previous',
    locationPath: string,
    message?: string,
  ) {
    super(
      message ??
        `Unsupported feature '${feature}' encountered at '${locationPath}' in Milestone 1.`,
    );
    this.name = 'UnsupportedFeatureError';
    this.feature = feature;
    this.locationPath = locationPath;
  }
}
