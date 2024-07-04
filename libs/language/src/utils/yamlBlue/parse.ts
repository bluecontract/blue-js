import yaml from 'js-yaml';
import { YAML_BLUE_SCHEMA } from './schema';
import { jsonBlueValueSchema } from '../../schema';

/**
 * Parses string as single YAML document.
 * Returns either a json blue object, a string, a number, a boolean or null,
 * or throws YAMLException on error.
 */
export const yamlBlueParse = (value: string) => {
  const loadedYaml = yaml.load(value, { schema: YAML_BLUE_SCHEMA });
  if (loadedYaml === undefined) {
    return undefined;
  }

  const jsonBlueValue = jsonBlueValueSchema.parse(loadedYaml);

  return jsonBlueValue;
};
