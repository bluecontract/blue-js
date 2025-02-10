import { Converter } from './Converter';

export class NullConverter implements Converter {
  convert() {
    return null;
  }
}
