import yaml from 'js-yaml';
import { FloatType } from './type/float';
import { IntType } from './type/int';

export const YAML_BLUE_SCHEMA = yaml.CORE_SCHEMA.extend({
  implicit: [FloatType, IntType],
});
