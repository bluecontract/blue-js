import { Converter } from './Converter';
import { PrimitiveConverter } from './PrimitiveConverter';
import { ComplexObjectConverter } from './ComplexObjectConverter';
import { ArrayConverter } from './ArrayConverter';
import { SetConverter } from './SetConverter';
import { MapConverter } from './MapConverter';
import { z, ZodTypeAny, ZodLazy, ZodEffects } from 'zod';
import { NodeToObjectConverter } from './NodeToObjectConverter';
import { UnknownConverter } from './UnknownConverter';
import { AnyConverter } from './AnyConverter';
import { TupleConverter } from './TupleConverter';
import { isWrapperType } from '../../schema/utils';

const zodSchemaTypeNamesSchema = z.union([
  z.literal('ZodString'),
  z.literal('ZodNumber'),
  z.literal('ZodBoolean'),
  z.literal('ZodBigInt'),
  z.literal('ZodArray'),
  z.literal('ZodSet'),
  z.literal('ZodMap'),
  z.literal('ZodRecord'),
  z.literal('ZodObject'),
  z.literal('ZodEnum'),
  z.literal('ZodNativeEnum'),
  z.literal('ZodUnknown'),
  z.literal('ZodAny'),
  z.literal('ZodTuple'),
]);

type ZodSchemaTypeNames = z.infer<typeof zodSchemaTypeNamesSchema>;

export class ConverterFactory {
  private readonly converters = new Map<ZodSchemaTypeNames, Converter>();
  private readonly complexObjectConverter: ComplexObjectConverter;

  constructor(private readonly nodeToObjectConverter: NodeToObjectConverter) {
    this.registerConverters();

    this.complexObjectConverter = new ComplexObjectConverter(
      this.nodeToObjectConverter
    );
  }

  private registerConverters() {
    const primitiveConverter = new PrimitiveConverter();
    const arrayConverter = new ArrayConverter(this.nodeToObjectConverter);
    const tupleConverter = new TupleConverter(this.nodeToObjectConverter);
    const setConverter = new SetConverter(this.nodeToObjectConverter);
    const mapConverter = new MapConverter(this.nodeToObjectConverter);

    // Register primitive type converters
    this.converters.set('ZodString', primitiveConverter);
    this.converters.set('ZodNumber', primitiveConverter);
    this.converters.set('ZodBoolean', primitiveConverter);
    this.converters.set('ZodBigInt', primitiveConverter);
    this.converters.set('ZodEnum', primitiveConverter);
    this.converters.set('ZodNativeEnum', primitiveConverter);

    // Register unknown converter
    this.converters.set('ZodUnknown', new UnknownConverter());

    // Register any converter
    this.converters.set('ZodAny', new AnyConverter());

    // Register collection converters
    this.converters.set('ZodArray', arrayConverter);
    this.converters.set('ZodTuple', tupleConverter);
    this.converters.set('ZodSet', setConverter);
    this.converters.set('ZodMap', mapConverter);
    this.converters.set('ZodRecord', mapConverter);

    // Register object converter as default
    this.converters.set('ZodObject', this.complexObjectConverter);
  }

  getConverter(targetType: ZodTypeAny): Converter {
    const schemaTargetTypeName = this.getSchemaTypeName(targetType);

    return (
      this.converters.get(schemaTargetTypeName) ?? this.complexObjectConverter
    );
  }

  private getSchemaTypeName(schema: ZodTypeAny): ZodSchemaTypeNames {
    if (isWrapperType(schema)) {
      if (schema instanceof ZodEffects) {
        return this.getSchemaTypeName(schema.innerType());
      }
      if (schema instanceof ZodLazy) {
        return this.getSchemaTypeName(schema.schema);
      }
      return this.getSchemaTypeName(schema.unwrap());
    }

    const schemaTypeName = schema._def.typeName;

    try {
      const parsedSchemaTypeName =
        zodSchemaTypeNamesSchema.parse(schemaTypeName);
      return parsedSchemaTypeName;
    } catch {
      throw new Error(`Schema type name ${schemaTypeName} is not supported`);
    }
  }
}
