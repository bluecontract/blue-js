import { blueObjectSchema, JsonBlueValue } from '../schema';
import { NodeToObjectConverter } from './mapping';
import { BlueNode, NodeDeserializer } from './model';
import { NodeToMapListOrValue, TypeSchemaResolver } from './utils';
import { ZodTypeDef, ZodType } from 'zod';
import { calculateBlueId, calculateBlueIdSync, yamlBlueParse } from '../utils';

export class Blue {
  constructor(private typeSchemaResolver: TypeSchemaResolver) {}

  public nodeToSchemaOutput<
    Output = unknown,
    Def extends ZodTypeDef = ZodTypeDef,
    Input = Output
  >(node: BlueNode, schema: ZodType<Output, Def, Input>): Output {
    const converter = new NodeToObjectConverter(this.typeSchemaResolver);
    return converter.convert(node, schema);
  }

  public jsonValueToNode(json: JsonBlueValue) {
    return NodeDeserializer.deserialize(json);
  }

  public yamlToNode(yaml: string) {
    const json = yamlBlueParse(yaml);
    if (!json) {
      throw new Error('Failed to parse YAML to JSON');
    }
    return this.jsonValueToNode(json);
  }

  public nodeToBlueObject(node: BlueNode) {
    try {
      const jsonBlueObject = NodeToMapListOrValue.get(node);
      return blueObjectSchema.parse(jsonBlueObject);
    } catch (error) {
      throw new Error(`Failed transforming BlueNode to BlueObject: ${error}`);
    }
  }

  public jsonValueToBlueObject(json: JsonBlueValue) {
    const node = this.jsonValueToNode(json);
    return this.nodeToBlueObject(node);
  }

  public yamlToBlueObject(yaml: string) {
    const node = this.yamlToNode(yaml);
    return this.nodeToBlueObject(node);
  }

  public calculateBlueId(value: JsonBlueValue) {
    return calculateBlueId(value);
  }

  public calculateBlueIdSync(value: JsonBlueValue) {
    return calculateBlueIdSync(value);
  }
}
