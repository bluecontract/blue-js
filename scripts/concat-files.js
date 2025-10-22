#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { minimatch } from 'minimatch';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Glob patterns to exclude
const EXCLUDED_PATTERNS = [
  '**/__tests__/**',
  '**/test/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/dist/**',
  '**/node_modules/**',
  '**/build/**',
  '**/coverage/**',
  '**/logs/**',
  '**/temp/**',
  '**/tmp/**',
  '**/cache/**',
  '**/temp/**',
  '**/scripts/benchmark/data/**',

  // '**/lib/utils/**',
  // '**/lib/mapping/**',
];

// Glob patterns to include (empty by default, which means include everything not excluded)
const INCLUDED_PATTERNS = [
  '**/language/src/**',
  '**/language/scripts/**',
  '**/language/project.json',
  '**/language/vite.config.ts',
  '**/language/vitest.config.ts',
  '**/language/vitest.config.mts',
  '**/language/vitest.config.js',
  '**/language/vitest.config.mjs',
  '**/language/vitest.config.cjs',
  '**/language/package.json',
  '**/language/package-lock.json',
  '**/language/package-lock.json',
  '**/language/tsconfig.json',
  '**/language/tsconfig.lib.json',
  '**/language/tsconfig.spec.json',
  '**/language/tsconfig.base.json',
  '**/language/tsconfig.app.json',
  '**/language/tsconfig.lib.json',
  '**/language/vitest.config.cjs',
  '**/language/vitest.config.mjs',
  '**/language/eslint.config.js',
  '**/language/ts-to-zod.config.js',
  '**/language/vitest-setup.ts',
  '**/language/LICENSE',
  // '**/language/src/lib/utils/**',
  // '**/language/src/lib/mapping/**',
];

// Source directory to process
const SOURCE_DIR = './libs';

// File extensions to include (add more if needed)
const INCLUDED_EXTENSIONS = [
  '.ts',
  '.js',
  '.tsx',
  '.jsx',
  '.json',
  '.md',
  '.css',
  '.html',
  '.scss',
  '.less',
];

// Function to check if path should be excluded
function shouldExclude(filePath) {
  // Convert to a normalized relative path for pattern matching
  const normalizedPath = filePath.replace(/\\/g, '/');
  return EXCLUDED_PATTERNS.some((pattern) =>
    minimatch(normalizedPath, pattern)
  );
}

// Function to check if path matches include patterns (if any are specified)
function matchesIncludePatterns(filePath) {
  // If no include patterns are specified, include everything
  if (INCLUDED_PATTERNS.length === 0) {
    return true;
  }

  // Convert to a normalized relative path for pattern matching
  const normalizedPath = filePath.replace(/\\/g, '/');
  return INCLUDED_PATTERNS.some((pattern) =>
    minimatch(normalizedPath, pattern)
  );
}

// Function to check if file should be included
function shouldIncludeFile(filePath) {
  if (shouldExclude(filePath)) {
    return false;
  }

  // Check if file matches include patterns (if any)
  if (!matchesIncludePatterns(filePath)) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  return INCLUDED_EXTENSIONS.includes(ext);
}

// Recursively get all files from directory
async function getAllFiles(dir) {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip paths matching exclude patterns
    if (shouldExclude(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively process subdirectories
      const subDirFiles = await getAllFiles(fullPath);
      results = results.concat(subDirFiles);
    } else if (shouldIncludeFile(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

// Process command line arguments
function processArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--include' || args[i] === '-i') {
      if (i + 1 < args.length) {
        // Clear existing patterns if this is the first --include flag
        if (INCLUDED_PATTERNS.length === 0) {
          // Keep it empty on first use, which means we're now in "opt-in" mode
        }
        INCLUDED_PATTERNS.push(args[i + 1]);
        i++; // Skip the next argument as we've already processed it
      }
    } else if (args[i] === '--exclude' || args[i] === '-e') {
      if (i + 1 < args.length) {
        EXCLUDED_PATTERNS.push(args[i + 1]);
        i++; // Skip the next argument as we've already processed it
      }
    }
  }
}

// Main function
async function concatenateFiles() {
  try {
    // Process command line arguments
    processArgs();

    console.log('Finding files to concatenate from apps directory...');
    if (INCLUDED_PATTERNS.length > 0) {
      console.log('Include patterns:', INCLUDED_PATTERNS);
    }
    console.log('Exclude patterns:', EXCLUDED_PATTERNS);

    const files = await getAllFiles(SOURCE_DIR);
    console.log(`Found ${files.length} files to process.`);

    let concatenated = '';
    let fileCount = 0;

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        const fileHeader = `\n\n// ==================== FILE: ${file} ====================\n\n`;
        concatenated += fileHeader + content;
        fileCount++;
        if (fileCount % 10 === 0) {
          console.log(`Processed ${fileCount} files...`);
        }
      } catch (err) {
        console.error(`Error reading file ${file}:`, err.message);
      }
    }

    // Write to output file
    const outputFile = 'src-concatenated.txt';
    await fs.writeFile(outputFile, concatenated);
    console.log(
      `\nSuccessfully concatenated ${fileCount} files from src directory to ${outputFile}`
    );
    console.log(`Total size: ${(concatenated.length / 1024).toFixed(2)} KB`);
  } catch (err) {
    console.error('Error:', err);
  }
}

// Run the script
concatenateFiles();
