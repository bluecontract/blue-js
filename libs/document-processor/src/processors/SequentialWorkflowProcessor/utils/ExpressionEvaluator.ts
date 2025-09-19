import { ProcessingContext } from '../../../types';
import {
  CodeBlockEvaluationError,
  ExpressionEvaluationError,
} from '../../../utils/exceptions';

// Type alias for isolated-vm Module
type Module = import('isolated-vm').Module;

/**
 * Bindings that will be available inside the VM
 */
export interface VMBindings {
  [key: string]: unknown;
  document?: (path: string) => unknown;
  event?: unknown;
  steps?: Record<string, unknown>;
}

let ivm: typeof import('isolated-vm') | null = null;
try {
  ivm = require('isolated-vm');
} catch {
  ivm = null;
}

/**
 * Checks if a code string contains ES module syntax (import/export)
 */
function hasModuleSyntax(code: string): boolean {
  return (
    /\bimport\s.+\sfrom\s+['"][^'"]+['"]/.test(code) || /\bexport\s+/.test(code)
  );
}

/**
 * ExpressionEvaluator - Evaluates JavaScript code and expressions securely
 *
 * Features:
 * - Plain expressions and code blocks evaluation
 * - Support for ES modules with static import/export
 * - Support for "blue:<blueId>" module specifiers
 * - Support for HTTP/HTTPS URLs for external modules
 */
export class ExpressionEvaluator {
  /**
   * Main evaluation method - evaluates code securely in an isolated VM
   */
  static async evaluate({
    code,
    ctx,
    bindings = {},
    options = {},
  }: {
    code: string;
    ctx: ProcessingContext;
    bindings?: VMBindings;
    options?: { isCodeBlock?: boolean; timeout?: number };
  }): Promise<unknown> {
    if (!ivm) {
      throw new Error('isolated-vm is required for expression evaluation');
    }
    return this.evaluateSecure(code, bindings, ctx, options);
  }

  /**
   * Secure evaluation using isolated-vm with support for ES modules
   */
  private static async evaluateSecure(
    code: string,
    bindings: VMBindings,
    ctx: ProcessingContext,
    options: { isCodeBlock?: boolean; timeout?: number } = {}
  ): Promise<unknown> {
    if (!ivm) throw new Error('isolated-vm not available');

    const isolate = new ivm.Isolate({ memoryLimit: 32 });
    const context = await isolate.createContext();
    const global = context.global;

    try {
      await this.setupIsolateEnvironment(global, bindings);

      const moduleCache = new Map<string, Module>();
      const resolve = this.createModuleResolver(
        isolate,
        context,
        moduleCache,
        ctx
      );

      let result: unknown;
      if (!hasModuleSyntax(code)) {
        // Simple script evaluation (no imports/exports)
        result = await this.evaluateSimpleScript(
          isolate,
          context,
          code,
          bindings,
          options
        );
      } else {
        // ES Module evaluation
        result = await this.evaluateESModule(
          isolate,
          context,
          code,
          options,
          resolve
        );
      }
      return this.deepClone(result);
    } catch (err) {
      if (options.isCodeBlock) {
        throw new CodeBlockEvaluationError(code, err);
      }
      throw new ExpressionEvaluationError(code, err);
    } finally {
      context.release();
      isolate.dispose();
    }
  }

  /**
   * Setup the isolated VM environment with necessary host functions and data
   */
  private static async setupIsolateEnvironment(
    global: import('isolated-vm').Context['global'],
    bindings: VMBindings
  ): Promise<void> {
    if (!ivm) throw new Error('isolated-vm not available');

    const logCb = new ivm.Callback((...args: unknown[]) =>
      console.log(...args)
    );

    // Create a console object with log method
    const consoleObj = new ivm.ExternalCopy({
      log: logCb,
    }).copyInto();

    await global.set('console', consoleObj);

    for (const [key, value] of Object.entries(bindings)) {
      if (typeof value === 'function') {
        await global.set(
          key,
          new ivm.Callback(value as (...args: unknown[]) => unknown)
        );
      } else {
        await global.set(key, new ivm.ExternalCopy(value).copyInto());
      }
    }
  }

  /**
   * Create module resolver function for handling imports
   */
  private static createModuleResolver(
    isolate: import('isolated-vm').Isolate,
    context: import('isolated-vm').Context,
    moduleCache: Map<string, Module>,
    ctx: ProcessingContext
  ): (specifier: string, referrer: Module) => Promise<Module> {
    return async (specifier: string) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (moduleCache.has(specifier)) return moduleCache.get(specifier)!;

      if (specifier.startsWith('blue:')) {
        const blueId = specifier.slice(5);
        const fetchFn = ctx.loadBlueContent;

        if (typeof fetchFn !== 'function') {
          throw new Error(
            `ProcessingContext is missing a loadBlueContent(blueId) implementation (needed for ${specifier})`
          );
        }

        const source: string = await fetchFn(blueId);
        const mod = await isolate.compileModule(source);
        moduleCache.set(specifier, mod);
        await mod.instantiate(
          context,
          this.createModuleResolver(isolate, context, moduleCache, ctx)
        );
        return mod;
      }

      if (/^https?:\/\//.test(specifier)) {
        let src;
        if (typeof ctx.loadExternalModule === 'function') {
          src = await ctx.loadExternalModule(specifier);
        } else {
          throw new Error(
            `ProcessingContext is missing a loadExternalModule(url) implementation (needed for ${specifier})`
          );
        }

        const mod = await isolate.compileModule(src);
        moduleCache.set(specifier, mod);
        await mod.instantiate(
          context,
          this.createModuleResolver(isolate, context, moduleCache, ctx)
        );
        return mod;
      }

      throw new Error(`Unsupported module specifier "${specifier}"`);
    };
  }

  /**
   * Evaluate code as a simple script (no imports/exports)
   */
  private static async evaluateSimpleScript(
    isolate: import('isolated-vm').Isolate,
    context: import('isolated-vm').Context,
    code: string,
    bindings: VMBindings,
    options: { isCodeBlock?: boolean; timeout?: number }
  ): Promise<unknown> {
    const bindingNames = Object.keys(bindings).join(', ');
    const bindingValues = Object.keys(bindings).map((k) => k);

    const rawScript = `(async (${bindingNames}) => { ${
      options.isCodeBlock ? code : `return (${code});`
    } })(${bindingValues.join(', ')})`;

    const script = await isolate.compileScript(rawScript);

    return await script.run(context, {
      timeout: options.timeout ?? 500,
      promise: true,
      copy: true,
      release: true,
    });
  }

  /**
   * Evaluate code as an ES module with import/export support
   */
  private static async evaluateESModule(
    isolate: import('isolated-vm').Isolate,
    context: import('isolated-vm').Context,
    code: string,
    options: { isCodeBlock?: boolean; timeout?: number },
    resolve: (specifier: string, referrer: Module) => Promise<Module>
  ): Promise<unknown> {
    let moduleCode = code;
    if (options.isCodeBlock) {
      const importExportRegex = /^\s*(import\s.+?;|export\s.+?;)/gm;
      const importExportLines = (code.match(importExportRegex) || []).join(
        '\n'
      );
      const codeWithoutImports = code.replace(importExportRegex, '').trim();

      moduleCode = `
      ${importExportLines}
      const run = function() {
        ${codeWithoutImports}
      };
      export default run();
      `;
    }

    const root = await isolate.compileModule(moduleCode);
    await root.instantiate(context, resolve);

    await root.evaluate({
      timeout: options.timeout ?? 500,
      promise: true,
      reference: true,
      release: true,
    });

    const namespace = root.namespace;
    return await namespace.get('default', {
      timeout: options.timeout ?? 500,
      promise: true,
      copy: true,
      release: true,
    });
  }

  /**
   * Deep clones a value by serializing and deserializing it to/from JSON,
   * which strips any isolate-specific object references.
   */
  private static deepClone<T = unknown>(value: T): T {
    if (typeof value === 'undefined') {
      return value;
    }
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
