import {
  isBigNumber,
  isJsonBluePrimitive,
  isReadonlyArray,
} from '../../utils/typeGuards';
import { JsonBlueValue, JsonBluePrimitive } from '../../types';
import { Big } from 'big.js';

export class JsonCanonicalizer {
  static canonicalize(object: JsonBlueValue): string {
    const buffer: string[] = [];
    JsonCanonicalizer.serialize(object, buffer);
    return buffer.join('');
  }

  private static serialize(object: JsonBlueValue, buffer: string[]): void {
    if (isJsonBluePrimitive(object) || isBigNumber(object)) {
      buffer.push(JsonCanonicalizer.stringify(object));
    } else if (Array.isArray(object) || isReadonlyArray(object)) {
      buffer.push('[');
      object.forEach((item, index: number) => {
        if (index > 0) buffer.push(',');
        JsonCanonicalizer.serialize(item, buffer);
      });
      buffer.push(']');
    } else {
      const keys = Object.keys(object).sort();
      buffer.push('{');
      keys.forEach((key, index) => {
        if (index > 0) buffer.push(',');
        buffer.push(JsonCanonicalizer.stringify(key));
        buffer.push(':');
        JsonCanonicalizer.serialize(object[key], buffer);
      });
      buffer.push('}');
    }
  }

  private static stringify(value: JsonBluePrimitive | Big): string {
    if (typeof value === 'string') {
      return `"${JsonCanonicalizer.escape(value)}"`;
    } else {
      return value === null ? 'null' : value.toString();
    }
  }

  private static escape(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\\"\u0000-\u001F\u2028\u2029]/g, (c: string) => {
      switch (c) {
        case '\\':
          return '\\\\';
        case '"':
          return '\\"';
        case '\n':
          return '\\n';
        case '\r':
          return '\\r';
        case '\b':
          return '\\b';
        case '\f':
          return '\\f';
        case '\t':
          return '\\t';
        default: {
          if (c <= String.fromCharCode(0x1f)) {
            return '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
          }
          return c;
        }
      }
    });
  }
}
