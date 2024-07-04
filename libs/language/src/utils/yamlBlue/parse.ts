import yaml from 'js-yaml';
import { YAML_BLUE_SCHEMA } from './schema';
import { JsonBlueValue, jsonBlueValueSchema } from '../../schema';

/**
 * Parses string as single YAML document.
 * Returns either a json blue object, a string, a number, a boolean, null or undefined if the YAML document is empty.
 * Throws YAMLException on error, typically due to bad syntax.
 */
export const yamlBlueParse = (value: string): JsonBlueValue | undefined => {
  const loadedYaml = yaml.load(value, { schema: YAML_BLUE_SCHEMA });
  if (loadedYaml === undefined) {
    return undefined;
  }

  const jsonBlueValue = jsonBlueValueSchema.parse(loadedYaml);

  return jsonBlueValue;
};
