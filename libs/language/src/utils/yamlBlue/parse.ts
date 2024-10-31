import yaml from 'js-yaml';
import { YAML_BLUE_SCHEMA } from './schema';
import { JsonBlueValue } from '../../schema';

/**
 * Parses string as single YAML document.
 * Returns either a json blue object, a string, a number, a boolean, null or undefined if the YAML document is empty.
 * @throws YAMLException - typically due to bad syntax of yaml
 * @throws Error - if the parsed yaml is not a valid json like object
 */
export const yamlBlueParse = (value: string): JsonBlueValue | undefined => {
  const loadedYaml = yaml.load(value, { schema: YAML_BLUE_SCHEMA });
  if (loadedYaml === undefined) {
    return undefined;
  }

  /**
   * Direct type assertion is used instead of schema validation for performance optimization.
   *
   * Historical Context:
   * Previously, we utilized `jsonBlueValueSchema.parse(loadedYaml)` for strict schema validation.
   * However, this approach proved to be computationally expensive for large object structures,
   * resulting in significant performance bottlenecks.
   *
   * Current Implementation:
   * Since the YAML schema is now maintained as a strict subset of JsonBlueValue,
   * we can safely perform type assertion without runtime validation,
   * significantly improving parsing performance for large datasets.
   */
  const jsonBlueValue = loadedYaml as unknown as JsonBlueValue;

  return jsonBlueValue;
};
