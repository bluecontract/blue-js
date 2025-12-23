import fs from 'fs';
import path from 'path';
import { yamlBlueParse } from '@blue-labs/language';
import type { JsonValue } from '@blue-labs/shared-utils';
import { DiscoveredType, JsonMap, Alias } from './internalTypes';
import {
  PRIMITIVE_TYPES,
  IGNORED_PACKAGE_DIRS,
  BLUE_TYPE_STATUS,
} from './constants';

export function discoverTypes(repoRoot: string): Map<Alias, DiscoveredType> {
  const packages = fs.readdirSync(repoRoot, { withFileTypes: true });
  const discovered = new Map<Alias, DiscoveredType>();

  for (const entry of packages) {
    if (!entry.isDirectory() || IGNORED_PACKAGE_DIRS.has(entry.name)) {
      continue;
    }

    const packagePath = path.join(repoRoot, entry.name);
    const blueFiles = findBlueFiles(packagePath);
    if (blueFiles.length === 0) {
      continue;
    }

    for (const filePath of blueFiles) {
      const status: DiscoveredType['status'] = filePath.endsWith('.dev.blue')
        ? BLUE_TYPE_STATUS.Dev
        : BLUE_TYPE_STATUS.Stable;
      const content = parseTypeFile(filePath);
      const typeName = extractTypeName(content, filePath);
      const alias = `${entry.name}/${typeName}` as Alias;

      const existing = discovered.get(alias);
      if (existing) {
        if (existing.status !== status) {
          throw new Error(
            `Type ${alias} has both stable and dev definitions (${existing.filePath} and ${filePath}).`,
          );
        }
        throw new Error(
          `Type ${alias} is defined multiple times (${existing.filePath} and ${filePath}).`,
        );
      }

      const references = collectReferences(content, filePath);
      discovered.set(alias, {
        packageName: entry.name,
        typeName,
        status,
        content,
        filePath,
        references,
      });
    }
  }

  return discovered;
}

function parseTypeFile(filePath: string): JsonMap {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = yamlBlueParse(raw) as JsonMap | undefined;
  if (!isRecord(parsed)) {
    throw new Error(`Type file ${filePath} must contain a YAML object.`);
  }
  return parsed as JsonMap;
}

function extractTypeName(content: JsonMap, filePath: string): string {
  if (!isRecord(content) || typeof content.name !== 'string') {
    throw new Error(`Type file ${filePath} is missing required "name" field.`);
  }
  return content.name;
}

function findBlueFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...findBlueFiles(path.join(dir, entry.name)));
      continue;
    }

    if (entry.name.endsWith('.blue') || entry.name.endsWith('.dev.blue')) {
      files.push(path.join(dir, entry.name));
    }
  }

  return files;
}

function collectReferences(content: JsonMap, filePath: string): Set<Alias> {
  const references = new Set<Alias>();

  const visit = (value: JsonValue) => {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item as JsonValue));
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    const maybeAdd = (candidate: unknown) => {
      if (typeof candidate !== 'string') {
        return;
      }
      if (PRIMITIVE_TYPES.has(candidate)) {
        return;
      }
      if (!candidate.includes('/')) {
        throw new Error(
          `Invalid type reference "${candidate}" in ${filePath}. Use <Package>/<Type> for non-primitive references.`,
        );
      }
      references.add(candidate as Alias);
    };

    maybeAdd(value.type);
    maybeAdd(value.itemType);
    maybeAdd(value.keyType);
    maybeAdd(value.valueType);

    Object.values(value).forEach((v) => visit(v as JsonValue));
  };

  visit(content);

  return references;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
