/**
 * Type definition for BlueIds objects
 */
export type BlueIdsRecord = Record<string, string>;

/**
 * Utility class for generating YAML mappings from BlueIds objects
 * This class provides a centralized way to manage and generate YAML mappings
 * from various BlueIds collections, making it easy to extend with new collections.
 */
export class BlueIdsMappingGenerator {
  private blueIdsCollections: BlueIdsRecord[] = [];

  /**
   * Initializes the generator with default BlueIds collections
   * @param defaultCollections - Array of default BlueIds objects to initialize with
   */
  initialize(...defaultCollections: BlueIdsRecord[]): void {
    this.blueIdsCollections = [...defaultCollections];
  }

  /**
   * Registers additional BlueIds collections for mapping generation
   * @param blueIdsCollections - Array of BlueIds objects to register
   */
  registerBlueIds(...blueIdsCollections: BlueIdsRecord[]): void {
    this.blueIdsCollections.push(...blueIdsCollections);
  }

  /**
   * Generates YAML mappings section from all registered BlueIds collections
   * @param transformationBlueId - The BlueId for the transformation type (defaults to the standard one)
   * @returns YAML string with mappings for all BlueIds
   */
  generateMappingsYaml(
    transformationBlueId = '27B7fuxQCS1VAptiCPc2RMkKoutP5qxkh3uDxZ7dr6Eo',
  ): string {
    const allMappings: Record<string, string> = {};

    // Merge all BlueIds collections, with later ones taking precedence
    for (const blueIdsCollection of this.blueIdsCollections) {
      Object.assign(allMappings, blueIdsCollection);
    }

    // Generate YAML mappings section
    const mappingsEntries = Object.entries(allMappings)
      .map(([name, blueId]) => `    ${name}: ${blueId}`)
      .join('\n');

    return `- type:
    blueId: ${transformationBlueId}
  mappings:
${mappingsEntries}`;
  }

  /**
   * Gets all currently registered BlueIds as a merged object
   * @returns Merged object containing all BlueIds from all collections
   */
  getAllBlueIds(): Record<string, string> {
    const allMappings: Record<string, string> = {};

    for (const blueIdsCollection of this.blueIdsCollections) {
      Object.assign(allMappings, blueIdsCollection);
    }

    return allMappings;
  }

  /**
   * Gets the names of all registered BlueIds
   * @returns Array of all BlueId names
   */
  getAllBlueIdNames(): string[] {
    return Object.keys(this.getAllBlueIds());
  }

  /**
   * Clears all registered BlueIds collections
   */
  clear(): void {
    this.blueIdsCollections = [];
  }

  /**
   * Gets the count of registered BlueIds collections
   * @returns Number of registered collections
   */
  getCollectionCount(): number {
    return this.blueIdsCollections.length;
  }

  /**
   * Gets the total count of unique BlueIds across all collections
   * @returns Number of unique BlueIds
   */
  getTotalBlueIdCount(): number {
    return Object.keys(this.getAllBlueIds()).length;
  }
}
