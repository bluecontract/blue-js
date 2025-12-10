import { JsonBlueValue } from '@blue-labs/language';
import { BlueTypeMetadata } from '../types';
import { BlueTypeStatusLiteral } from './constants';

export type PackageName = string;
export type TypeName = string;
export type Alias = `${PackageName}/${TypeName}`;

export type JsonMap = Record<string, JsonBlueValue>;

export interface DiscoveredType {
  packageName: PackageName;
  typeName: TypeName;
  status: BlueTypeStatusLiteral;
  content: JsonMap;
  filePath: string;
  references: Set<Alias>;
}

export type PackageTypeMap = Map<PackageName, Map<TypeName, BlueTypeMetadata>>;
