import Big from 'big.js';

import { BexException } from '../BexException';
import { BexGasSchedule } from '../gas/BexGasSchedule';
import {
  BexChangeset,
  BexEvents,
  BexExecutionResult,
  BexMetrics,
  BexPatchEntry,
} from '../result/BexExecutionResult';
import { BlueIdCalculator } from '@blue-labs/language';
import { BexValue, BexValues, nodeToSimple } from '../value/BexValues';
import { sortBexKeys } from '../value/key-order';
import { BexDocumentView, BexExecutionContext } from './BexExecutionContext';
import {
  BexIntrinsicProcessor,
  BexIntrinsicRegistry,
} from './BexIntrinsicRegistry';
import { BexProgramExtractor } from './BexProgramExtractor';
import { BexProgramSource } from './BexProgramSource';

type SimpleObject = Record<string, unknown>;

interface RuntimeState {
  gasUsed: number;
  changeset: BexChangeset;
  events: BexEvents;
  vars: Map<string, unknown>;
  metrics: BexMetrics;
}

interface BexFunctionDefinition {
  args: SimpleObject;
  expr?: unknown;
  do?: unknown;
}

interface CollectionEntry {
  key?: string;
  index: number;
  val: unknown;
}

class ReturnSignal {
  constructor(public readonly value: unknown) {}
}

export class BexCompiledProgram {
  constructor(
    public readonly program: SimpleObject,
    public readonly constants: Map<string, unknown>,
    public readonly functions: Map<string, BexFunctionDefinition>,
    public readonly entryName?: string,
    public readonly requiredIntrinsicBlueIds: ReadonlySet<string> = new Set(),
  ) {}
}

export class BexEngine {
  private compilingIntrinsicBlueIds?: Set<string>;

  public static builder(): BexEngineBuilder {
    return new BexEngineBuilder();
  }

  constructor(
    private readonly gasSchedule = BexGasSchedule.defaults(),
    private readonly intrinsics = BexIntrinsicRegistry.empty(),
  ) {}

  public compile(source: BexProgramSource): BexCompiledProgram {
    const program = this.normalizeBlueContainers(
      BexProgramExtractor.extract(source.node, {
        inputKind: source.inputKind,
      }),
    );
    if (!this.isObject(program)) {
      throw new BexException('BEX program must be an object.', 'compile-error');
    }

    const definition =
      source.definitionNode === undefined
        ? undefined
        : this.normalizeBlueContainers(
            BexProgramExtractor.extract(source.definitionNode, {
              inputKind: source.inputKind,
            }),
          );
    if (definition !== undefined && !this.isObject(definition)) {
      throw new BexException(
        'BEX definition must be an object.',
        'compile-error',
      );
    }

    const requiredIntrinsicBlueIds = new Set<string>();
    this.compilingIntrinsicBlueIds = requiredIntrinsicBlueIds;
    try {
      const constants = this.compileConstants(
        program.constants,
        this.compileConstants(definition?.constants),
      );
      const functions = this.compileFunctions(
        program.functions,
        this.compileFunctions(definition?.functions),
      );
      this.validateNoRecursiveFunctions(functions);
      this.validateStaticBlueFields(definition, '/definition');
      this.validateStaticBlueFields(program, '/');
      this.validateReferences(program.expr, constants, functions, '/expr');
      this.validateStatements(
        program.do,
        constants,
        functions,
        '/do',
        new Set(),
      );
      for (const [name, definition] of functions) {
        this.validateReferences(
          definition.expr,
          constants,
          functions,
          `/functions/${this.escapePointer(name)}/expr`,
        );
        this.validateStatements(
          definition.do,
          constants,
          functions,
          `/functions/${this.escapePointer(name)}/do`,
          new Set(Object.keys(definition.args)),
        );
      }

      const entryName = this.resolveEntryName(source, program);
      if (entryName !== undefined) {
        const entry = functions.get(entryName);
        if (entry === undefined) {
          throw new BexException(
            `Unknown entry function: ${entryName}`,
            'compile-error',
          );
        }
        if (Object.keys(entry.args).length > 0) {
          throw new BexException(
            `Entry function ${entryName} declares arguments but entry invocation provides none`,
            'compile-error',
          );
        }
      }

      return new BexCompiledProgram(
        program,
        constants,
        functions,
        entryName,
        requiredIntrinsicBlueIds,
      );
    } finally {
      this.compilingIntrinsicBlueIds = undefined;
    }
  }

  public execute(
    program: BexCompiledProgram,
    context: BexExecutionContext,
  ): BexExecutionResult {
    const state: RuntimeState = {
      gasUsed: 0,
      changeset: new BexChangeset(),
      events: new BexEvents(),
      vars: new Map(),
      metrics: new BexMetrics(),
    };
    this.chargeFunctionCall(state, context);
    let value: unknown = undefined;
    if (program.entryName !== undefined) {
      value = this.evalCall(
        { function: program.entryName, args: {} },
        context,
        state,
        program,
      );
    } else if ('expr' in program.program) {
      value = this.evalExpr(program.program.expr, context, state, program);
    } else if ('do' in program.program) {
      try {
        value = this.execBlock(program.program.do, context, state, program);
      } catch (signal) {
        if (signal instanceof ReturnSignal) {
          value = signal.value;
        } else {
          throw signal;
        }
      }
    } else {
      value = this.defaultResult(state);
    }
    return new BexExecutionResult(
      BexValues.fromSimple(value),
      state.changeset,
      state.events,
      state.gasUsed,
      state.metrics,
    );
  }

  public compileAndExecute(
    source: BexProgramSource,
    context: BexExecutionContext,
  ): BexExecutionResult {
    return this.execute(this.compile(source), context);
  }

  private compileConstants(
    value: unknown,
    constants = new Map<string, unknown>(),
  ): Map<string, unknown> {
    if (value === undefined) {
      return constants;
    }
    if (!this.isObject(value)) {
      throw new BexException('constants must be an object.', 'compile-error');
    }
    for (const [key, item] of Object.entries(value)) {
      this.rejectReservedUserName(key, 'constants');
      constants.set(key, this.cloneSimple(item));
    }
    return constants;
  }

  private normalizeBlueContainers(
    value: unknown,
    path: readonly string[] = [],
  ): unknown {
    if (Array.isArray(value)) {
      return value
        .map((item, index) =>
          this.normalizeBlueContainers(item, [...path, String(index)]),
        )
        .filter((item) => item !== undefined);
    }
    if (!this.isObject(value)) {
      return value;
    }

    const keys = Object.keys(value);
    const nameContainer = this.isBexNameContainer(path);
    const ordinaryKeys = keys.filter((key) => !this.blueWrapperKeys().has(key));
    if (
      !nameContainer &&
      Object.hasOwn(value, 'value') &&
      ordinaryKeys.length === 0 &&
      !Object.hasOwn(value, 'items')
    ) {
      return this.normalizeBlueContainers(value.value, [...path, 'value']);
    }
    if (
      !nameContainer &&
      Object.hasOwn(value, 'items') &&
      ordinaryKeys.length === 0 &&
      Array.isArray(value.items)
    ) {
      return this.normalizeBlueContainers(value.items, [...path, 'items']);
    }
    if (
      ordinaryKeys.length === 0 &&
      this.isDocumentationOnlyBlueContainer(value) &&
      !this.shouldPreserveDocumentationOnlyContainer(path)
    ) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => {
        const normalized = this.normalizeBlueContainers(item, [...path, key]);
        if (normalized === undefined && path[path.length - 1] !== 'args') {
          return [];
        }
        return [[key, normalized]];
      }),
    );
  }

  private isDocumentationOnlyBlueContainer(value: SimpleObject): boolean {
    if (Object.keys(value).length === 0) {
      return false;
    }
    for (const key of [
      'type',
      'itemType',
      'keyType',
      'valueType',
      'value',
      'items',
      'blueId',
      'blue',
      'schema',
      'constraints',
      'mergePolicy',
      'properties',
      'contracts',
    ]) {
      if (Object.hasOwn(value, key)) {
        return false;
      }
    }
    return true;
  }

  private shouldPreserveDocumentationOnlyContainer(
    path: readonly string[],
  ): boolean {
    const last = path[path.length - 1];
    const parent = path[path.length - 2];
    return (
      last === 'entry' ||
      last === 'functions' ||
      last === 'constants' ||
      last === 'args' ||
      parent === 'functions' ||
      parent === 'args'
    );
  }

  private isBexNameContainer(path: readonly string[]): boolean {
    const last = path[path.length - 1];
    const parent = path[path.length - 2];
    const grandparent = path[path.length - 3];
    return (
      last === 'functions' ||
      last === 'constants' ||
      (last === 'args' && parent === '$call') ||
      (last === 'args' && grandparent === 'functions')
    );
  }

  private compileFunctions(
    value: unknown,
    functions = new Map<string, BexFunctionDefinition>(),
  ): Map<string, BexFunctionDefinition> {
    if (value === undefined) {
      return functions;
    }
    if (!this.isObject(value)) {
      throw new BexException('functions must be an object.', 'compile-error');
    }
    for (const [name, definition] of Object.entries(value)) {
      this.rejectReservedUserName(name, 'functions');
      if (!this.isObject(definition)) {
        throw new BexException(
          `Function ${name} must be an object.`,
          'compile-error',
        );
      }
      const args = definition.args;
      if (args !== undefined && !this.isObject(args)) {
        throw new BexException(
          `Function ${name} args must be an object.`,
          'compile-error',
        );
      }
      for (const argName of Object.keys((args ?? {}) as SimpleObject)) {
        this.rejectReservedUserName(argName, `Function ${name} args`);
      }
      functions.set(name, {
        args: (args ?? {}) as SimpleObject,
        expr: definition.expr,
        do: definition.do,
      });
    }
    return functions;
  }

  private resolveEntryName(
    source: BexProgramSource,
    program: SimpleObject,
  ): string | undefined {
    const entry =
      source.entry !== undefined
        ? source.entry
        : program.entry === undefined
          ? undefined
          : typeof program.entry === 'string'
            ? program.entry
            : invalidEntry();
    const trimmed = entry?.trim();
    return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;

    function invalidEntry(): never {
      throw new BexException('BEX entry must be text.', 'compile-error', {
        sourcePath: '/entry',
      });
    }
  }

  private validateNoRecursiveFunctions(
    functions: Map<string, BexFunctionDefinition>,
  ): void {
    const calls = new Map<string, Set<string>>();
    for (const [name, definition] of functions) {
      const targets = new Set<string>();
      this.collectCalls(definition.expr, targets);
      this.collectCalls(definition.do, targets);
      calls.set(name, targets);
    }
    for (const name of calls.keys()) {
      this.detectFunctionCycle(name, name, calls, []);
    }
  }

  private detectFunctionCycle(
    root: string,
    current: string,
    calls: Map<string, Set<string>>,
    stack: string[],
  ): void {
    if (stack.includes(current)) {
      throw new BexException(
        `Recursive BEX function call rejected: ${current}`,
        'compile-error',
      );
    }
    const nextStack = [...stack, current];
    for (const next of calls.get(current) ?? []) {
      if (next === root) {
        throw new BexException(
          `Recursive BEX function call rejected: ${root}`,
          'compile-error',
        );
      }
      if (calls.has(next)) {
        this.detectFunctionCycle(root, next, calls, nextStack);
      }
    }
  }

  private collectCalls(value: unknown, calls: Set<string>): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectCalls(item, calls);
      }
      return;
    }
    if (!this.isObject(value)) {
      return;
    }
    if (this.isSingleOperator(value, '$literal')) {
      return;
    }
    if (this.isSingleOperator(value, '$is')) {
      const body = (value as SimpleObject)['$is'];
      if (this.isObject(body)) {
        this.collectCalls(body['node'], calls);
      }
      return;
    }
    if (this.isSingleOperator(value, '$call')) {
      const body = (value as SimpleObject)['$call'];
      if (this.isObject(body) && typeof body['function'] === 'string') {
        calls.add(body['function']);
      }
    }
    for (const child of Object.values(value)) {
      this.collectCalls(child, calls);
    }
  }

  private validateReferences(
    expression: unknown,
    constants: Map<string, unknown>,
    functions: Map<string, BexFunctionDefinition>,
    pointer: string,
  ): void {
    if (expression === undefined) {
      return;
    }
    if (Array.isArray(expression)) {
      expression.forEach((item, index) =>
        this.validateReferences(
          item,
          constants,
          functions,
          `${pointer}/${index}`,
        ),
      );
      return;
    }
    if (!this.isObject(expression)) {
      return;
    }
    if (this.isSingleOperator(expression, '$literal')) {
      this.validateStaticBlueFields(
        expression['$literal'],
        `${pointer}/$literal`,
      );
      return;
    }
    const keys = Object.keys(expression);
    const operatorKeys = keys.filter((key) => key.startsWith('$'));
    if (operatorKeys.length === 1 && keys.length === 1) {
      const operator = operatorKeys[0];
      if (!this.expressionOperators().has(operator)) {
        throw new BexException(
          `Unknown BEX operator: ${operator}`,
          'compile-error',
          {
            sourcePath: pointer,
            operator,
          },
        );
      }
    }
    if (this.isSingleOperator(expression, '$const')) {
      const constBody = expression['$const'];
      if (this.isObject(constBody)) {
        const name = constBody['name'];
        if (typeof name !== 'string' || !constants.has(name)) {
          throw new BexException(
            `Unknown constant: ${String(name)}`,
            'compile-error',
          );
        }
        this.validateReferences(
          constBody['path'],
          constants,
          functions,
          `${pointer}/$const/path`,
        );
        return;
      }
      if (
        typeof expression['$const'] !== 'string' ||
        !constants.has(expression['$const'])
      ) {
        throw new BexException(
          `Unknown constant: ${String(expression['$const'])}`,
          'compile-error',
        );
      }
      return;
    }
    if (this.isSingleOperator(expression, '$is')) {
      const body = (expression as SimpleObject)['$is'];
      if (!this.isObject(body) || !('node' in body) || !('pattern' in body)) {
        throw new BexException('$is payload kind is invalid.', 'parse-error');
      }
      if (this.containsBex(body['pattern'])) {
        throw new BexException(
          'BEX expressions inside static Blue patterns are not supported',
          'compile-error',
        );
      }
      this.validateReferences(
        body['node'],
        constants,
        functions,
        `${pointer}/$is/node`,
      );
      return;
    }
    if (this.isSingleOperator(expression, '$join')) {
      const body = (expression as SimpleObject)['$join'];
      if (this.isObject(body) && !('list' in body) && 'items' in body) {
        throw new BexException('$join payload kind is invalid.', 'parse-error');
      }
    }
    if (this.isSingleOperator(expression, '$call')) {
      this.validateCall(expression['$call'], constants, functions, pointer);
      return;
    }
    if (this.isSingleOperator(expression, '$intrinsic')) {
      const body = this.requireObject(
        expression['$intrinsic'],
        '$intrinsic expects an object body',
      );
      if (!('type' in body)) {
        throw new BexException('$intrinsic.type is required', 'compile-error');
      }
      this.validateStaticBlueFields(body.type, `${pointer}/$intrinsic/type`);
      const blueId = this.intrinsicTypeBlueId(body.type);
      if (blueId === undefined || blueId.length === 0) {
        throw new BexException(
          '$intrinsic.type must resolve to a BlueId',
          'compile-error',
        );
      }
      if (!this.intrinsics.supports(blueId)) {
        throw new BexException(
          `Unsupported intrinsic BlueId: ${blueId}`,
          'compile-error',
        );
      }
      this.compilingIntrinsicBlueIds?.add(blueId);
      for (const [key, value] of Object.entries(body)) {
        if (key === 'type') {
          continue;
        }
        this.validateReferences(
          value,
          constants,
          functions,
          `${pointer}/$intrinsic/${this.escapePointer(key)}`,
        );
      }
      return;
    }
    for (const [key, value] of Object.entries(expression)) {
      this.validateReferences(
        value,
        constants,
        functions,
        `${pointer}/${this.escapePointer(key)}`,
      );
    }
  }

  private validateStatements(
    statements: unknown,
    constants: Map<string, unknown>,
    functions: Map<string, BexFunctionDefinition>,
    pointer: string,
    declaredLocals: Set<string>,
  ): void {
    if (statements === undefined) {
      return;
    }
    if (!Array.isArray(statements)) {
      throw new BexException('Statement body must be a list.', 'compile-error');
    }
    statements.forEach((statement, index) => {
      if (!this.isObject(statement)) {
        throw new BexException(
          `Statement must be an operator object at ${pointer}/${index}`,
          'compile-error',
        );
      }
      const operators = Object.keys(statement).filter((key) =>
        key.startsWith('$'),
      );
      if (operators.length !== 1 || Object.keys(statement).length !== 1) {
        throw new BexException(
          `Statement must have exactly one $ operator at ${pointer}/${index}`,
          'compile-error',
        );
      }
      const op = operators[0];
      const body = statement[op];
      if (!this.statementOperators().has(op)) {
        throw new BexException(
          `Unknown statement operator: ${op}`,
          'compile-error',
        );
      }
      if (op === '$call') {
        this.validateCall(
          body,
          constants,
          functions,
          `${pointer}/${index}/${op}`,
        );
        return;
      }
      if (op === '$if' && this.isObject(body)) {
        this.validateReferences(
          body.cond,
          constants,
          functions,
          `${pointer}/${index}/${op}/cond`,
        );
        this.validateStatements(
          body.then,
          constants,
          functions,
          `${pointer}/${index}/${op}/then`,
          new Set(declaredLocals),
        );
        this.validateStatements(
          body.else,
          constants,
          functions,
          `${pointer}/${index}/${op}/else`,
          new Set(declaredLocals),
        );
        return;
      }
      if (op === '$forEach' && this.isObject(body)) {
        this.validateForEachBindings(body, `${pointer}/${index}/${op}`);
        this.validateReferences(
          body.in,
          constants,
          functions,
          `${pointer}/${index}/${op}/in`,
        );
        const loopLocals = new Set(declaredLocals);
        for (const key of ['item', 'key', 'index'] as const) {
          if (typeof body[key] === 'string') {
            loopLocals.add(body[key]);
          }
        }
        this.validateStatements(
          body.do,
          constants,
          functions,
          `${pointer}/${index}/${op}/do`,
          loopLocals,
        );
        return;
      }
      if (op === '$let' && this.isObject(body)) {
        if (this.isObject(body.vars)) {
          for (const [name, expr] of Object.entries(body.vars)) {
            this.validateReferences(
              expr,
              constants,
              functions,
              `${pointer}/${index}/${op}/vars/${this.escapePointer(name)}`,
            );
            declaredLocals.add(name);
          }
        } else {
          this.validateReferences(
            body.expr,
            constants,
            functions,
            `${pointer}/${index}/${op}/expr`,
          );
          if (typeof body.name === 'string') {
            declaredLocals.add(body.name);
          }
        }
        return;
      }
      if ((op === '$returnIf' || op === '$failIf') && this.isObject(body)) {
        this.validateReferences(
          body.cond,
          constants,
          functions,
          `${pointer}/${index}/${op}/cond`,
        );
        this.validateReferences(
          op === '$returnIf' ? body.expr : body.message,
          constants,
          functions,
          `${pointer}/${index}/${op}/${op === '$returnIf' ? 'expr' : 'message'}`,
        );
        return;
      }
      if (op === '$set' && this.isObject(body)) {
        if (typeof body.name === 'string' && !declaredLocals.has(body.name)) {
          throw new BexException(
            `Unknown local variable: ${body.name}`,
            'compile-error',
            {
              sourcePath: `${pointer}/${index}/${op}/name`,
              operator: op,
            },
          );
        }
        this.validateReferences(
          body.expr,
          constants,
          functions,
          `${pointer}/${index}/${op}/expr`,
        );
        return;
      }
      this.validateReferences(
        body,
        constants,
        functions,
        `${pointer}/${index}/${op}`,
      );
    });
  }

  private validateForEachBindings(body: SimpleObject, pointer: string): void {
    const names = ['item', 'key', 'index'].flatMap((key) => {
      const value = body[key];
      return typeof value === 'string' ? [value] : [];
    });
    if (new Set(names).size !== names.length) {
      throw new BexException(
        '$forEach item, key, and index bindings must be distinct.',
        'compile-error',
        {
          sourcePath: pointer,
          operator: '$forEach',
        },
      );
    }
  }

  private validateCall(
    body: unknown,
    constants: Map<string, unknown>,
    functions: Map<string, BexFunctionDefinition>,
    pointer: string,
  ): void {
    if (!this.isObject(body) || typeof body.function !== 'string') {
      throw new BexException('$call requires function.', 'compile-error');
    }
    const definition = functions.get(body.function);
    if (definition === undefined) {
      throw new BexException(
        `Unknown function: ${body.function}`,
        'compile-error',
      );
    }
    const args = body.args;
    if (args !== undefined && !this.isObject(args)) {
      throw new BexException('$call.args must be an object.', 'compile-error');
    }
    const provided = new Set(Object.keys((args ?? {}) as SimpleObject));
    const expected = new Set(Object.keys(definition.args));
    for (const arg of provided) {
      this.rejectReservedUserName(arg, '$call.args');
      if (!expected.has(arg)) {
        throw new BexException(
          `Unknown argument ${arg} for function ${body.function}`,
          'compile-error',
        );
      }
    }
    for (const arg of expected) {
      if (!provided.has(arg)) {
        throw new BexException(
          `Missing argument ${arg} for function ${body.function}`,
          'compile-error',
        );
      }
    }
    for (const [arg, value] of Object.entries((args ?? {}) as SimpleObject)) {
      this.validateReferences(
        value,
        constants,
        functions,
        `${pointer}/args/${this.escapePointer(arg)}`,
      );
    }
  }

  private validateStaticBlueFields(value: unknown, pointer: string): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        this.validateStaticBlueFields(item, `${pointer}/${index}`),
      );
      return;
    }
    if (!this.isObject(value)) {
      return;
    }
    for (const key of [
      'type',
      'itemType',
      'keyType',
      'valueType',
      'blue',
      'schema',
    ]) {
      if (key in value && this.containsBex(value[key])) {
        throw new BexException(
          `BEX expressions inside Blue ${key} fields are not supported at ${pointer}/${key}`,
          'compile-error',
        );
      }
    }
    for (const [key, child] of Object.entries(value)) {
      this.validateStaticBlueFields(
        child,
        `${pointer}/${this.escapePointer(key)}`,
      );
    }
  }

  private execBlock(
    statements: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    if (statements === undefined) {
      return this.defaultResult(state);
    }
    if (!Array.isArray(statements)) {
      throw new BexException('$do must be a list.', 'compile-error');
    }
    for (const statement of statements) {
      this.execStatement(statement, context, state, program);
    }
    return this.defaultResult(state);
  }

  private defaultResult(state: RuntimeState): SimpleObject {
    return {
      changeset: state.changeset.toSimple(),
      events: state.events.toSimple(),
    };
  }

  private execStatement(
    statement: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): void {
    state.metrics.statementExecutions += 1;
    this.charge(state, this.gasSchedule.values.statementBase, context);
    if (!this.isObject(statement)) {
      throw new BexException('Statement must be an object.', 'compile-error');
    }
    if ('$return' in statement) {
      const body = statement.$return;
      throw new ReturnSignal(
        body === undefined || body === null
          ? this.defaultResult(state)
          : this.evalExpr(body, context, state, program),
      );
    }
    if ('$let' in statement) {
      const spec = this.requireObject(
        statement.$let,
        '$let requires an object.',
      );
      if (this.isObject(spec.vars)) {
        for (const [name, expr] of Object.entries(spec.vars)) {
          state.vars.set(name, this.evalExpr(expr, context, state, program));
        }
        return;
      }
      const name = this.requireText(spec.name, '$let.name');
      state.vars.set(name, this.evalExpr(spec.expr, context, state, program));
      return;
    }
    if ('$set' in statement) {
      const spec = this.requireObject(
        statement.$set,
        '$set requires an object.',
      );
      const name = this.requireText(spec.name, '$set.name');
      if (!state.vars.has(name)) {
        throw new BexException(
          `Unknown local variable: ${name}`,
          'compile-error',
        );
      }
      state.vars.set(name, this.evalExpr(spec.expr, context, state, program));
      return;
    }
    if ('$if' in statement) {
      const spec = this.requireObject(statement.$if, '$if requires an object.');
      const chosen = this.truthy(
        this.evalExpr(spec.cond, context, state, program),
      )
        ? spec.then
        : spec.else;
      this.execBlock(chosen ?? [], context, state, program);
      return;
    }
    if ('$forEach' in statement) {
      this.execForEach(statement.$forEach, context, state, program);
      return;
    }
    if ('$appendChange' in statement) {
      this.appendChange(statement.$appendChange, context, state, program);
      return;
    }
    if ('$appendChanges' in statement) {
      const changes = this.evalExpr(
        statement.$appendChanges,
        context,
        state,
        program,
      );
      if (!Array.isArray(changes)) {
        throw new BexException('$appendChanges requires a list.');
      }
      for (const change of changes) {
        this.appendEvaluatedChange(change, context, state);
      }
      return;
    }
    if ('$appendEvent' in statement) {
      this.appendEvent(
        this.evalExpr(statement.$appendEvent, context, state, program),
        context,
        state,
      );
      return;
    }
    if ('$appendEvents' in statement) {
      const events = this.evalExpr(
        statement.$appendEvents,
        context,
        state,
        program,
      );
      if (!Array.isArray(events)) {
        throw new BexException('$appendEvents requires a list.');
      }
      for (const event of events) {
        this.appendEvent(event, context, state);
      }
      return;
    }
    if ('$call' in statement) {
      this.evalExpr({ $call: statement.$call }, context, state, program);
      return;
    }
    if ('$returnIf' in statement) {
      const spec = this.requireObject(
        statement.$returnIf,
        '$returnIf requires an object.',
      );
      if (this.truthy(this.evalExpr(spec.cond, context, state, program))) {
        throw new ReturnSignal(
          'expr' in spec
            ? this.evalExpr(spec.expr, context, state, program)
            : this.defaultResult(state),
        );
      }
      return;
    }
    if ('$failIf' in statement) {
      const spec = this.requireObject(
        statement.$failIf,
        '$failIf requires an object.',
      );
      if (this.truthy(this.evalExpr(spec.cond, context, state, program))) {
        throw new BexException(
          this.asText(this.evalExpr(spec.message, context, state, program)),
        );
      }
      return;
    }
    if ('$fail' in statement) {
      throw new BexException(
        this.asText(this.evalExpr(statement.$fail, context, state, program)),
      );
    }
  }

  private execForEach(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): void {
    const spec = this.requireObject(operand, '$forEach requires an object.');
    const input = this.evalExpr(spec.in, context, state, program);
    const itemName = this.requireText(spec.item, '$forEach.item');
    const keyName =
      spec.key === undefined
        ? undefined
        : this.requireText(spec.key, '$forEach.key');
    const indexName =
      spec.index === undefined
        ? undefined
        : this.requireText(spec.index, '$forEach.index');
    if (Array.isArray(input)) {
      input.forEach((item, index) => {
        this.charge(state, this.gasSchedule.values.forEachItem, context);
        state.vars.set(itemName, item);
        if (indexName !== undefined) {
          state.vars.set(indexName, index);
        }
        if (keyName !== undefined) {
          state.vars.set(keyName, undefined);
        }
        this.execBlock(spec.do ?? [], context, state, program);
      });
      return;
    }
    if (this.isObject(input)) {
      for (const key of sortBexKeys(Object.keys(input))) {
        this.charge(state, this.gasSchedule.values.forEachItem, context);
        if (keyName !== undefined) {
          state.vars.set(keyName, key);
          state.vars.set(itemName, input[key]);
        } else {
          state.vars.set(itemName, { key, val: input[key] });
        }
        if (indexName !== undefined) {
          state.vars.set(indexName, undefined);
        }
        this.execBlock(spec.do ?? [], context, state, program);
      }
      return;
    }
    throw new BexException('$forEach input must be list or object');
  }

  private appendChange(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): void {
    const spec = this.requireObject(
      operand,
      '$appendChange requires an object.',
    );
    const op = this.asText(
      this.evalTextOperand(
        spec.op,
        context,
        state,
        program,
        '$appendChange.op',
      ),
    );
    const path = this.pointerOperand(spec.path, context, state, program, false);
    const entry: BexPatchEntry = {
      op: this.patchOp(op),
      path: this.resolveDocumentPointer(path, context),
    };
    if (op !== 'remove') {
      if (!('val' in spec)) {
        throw new BexException(`Patch op ${op} requires val`);
      }
      entry.val = this.evalExpr(spec.val, context, state, program);
    }
    this.chargeValue(
      state,
      this.gasSchedule.values.appendChangeBase,
      entry.val,
      context,
    );
    state.metrics.patchAppends += 1;
    state.changeset.append(entry);
  }

  private appendEvaluatedChange(
    change: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
  ): void {
    const spec = this.requireObject(
      change,
      '$appendChanges item must be an object.',
    );
    const op = this.patchOp(this.requireText(spec.op, 'patch.op'));
    const path = this.pointerText(this.requireText(spec.path, 'patch.path'));
    const entry: BexPatchEntry = {
      op,
      path: this.resolveDocumentPointer(path, context),
    };
    if (op !== 'remove') {
      if (!('val' in spec)) {
        throw new BexException(`Patch op ${op} requires val`);
      }
      entry.val = spec.val;
    }
    this.chargeValue(
      state,
      this.gasSchedule.values.appendChangeBase,
      entry.val,
      context,
    );
    state.metrics.patchAppends += 1;
    state.changeset.append(entry);
  }

  private appendEvent(
    event: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
  ): void {
    if (event === undefined) {
      throw new BexException('Undefined cannot be emitted as an event');
    }
    this.chargeValue(
      state,
      this.gasSchedule.values.appendEventBase,
      event,
      context,
    );
    state.metrics.eventAppends += 1;
    state.events.append(event);
  }

  private evalExpr(
    expression: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    state.metrics.expressionEvaluations += 1;
    this.charge(state, this.gasSchedule.values.expressionBase, context);
    if (Array.isArray(expression)) {
      if (!this.containsBex(expression)) {
        return this.cloneSimple(expression);
      }
      return expression.map((item, index) => {
        const value = this.evalExpr(item, context, state, program);
        if (value === undefined) {
          throw new BexException(
            `Undefined cannot appear in list literal item ${index}.`,
          );
        }
        return value;
      });
    }
    if (!this.isObject(expression)) {
      return expression;
    }
    const keys = Object.keys(expression);
    const operatorKeys = keys.filter((key) => key.startsWith('$'));
    if (operatorKeys.length === 1 && keys.length === 1) {
      return this.evalOperator(
        operatorKeys[0],
        expression[operatorKeys[0]],
        context,
        state,
        program,
      );
    }
    if (!this.containsBex(expression)) {
      return this.cloneSimple(expression);
    }
    const out: SimpleObject = {};
    for (const key of sortBexKeys(keys)) {
      const value = this.evalExpr(expression[key], context, state, program);
      if (value !== undefined) {
        out[key] = value;
      }
    }
    return out;
  }

  private evalOperator(
    operator: string,
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    switch (operator) {
      case '$literal':
        return this.cloneSimple(operand);
      case '$null':
        return null;
      case '$emptyObject':
        return {};
      case '$emptyList':
        return [];
      case '$document':
        state.metrics.documentReads += 1;
        this.charge(state, this.gasSchedule.values.documentRead, context);
        return this.readDocument(context, operand, state, program);
      case '$binding':
        this.charge(state, this.gasSchedule.values.varRead, context);
        return this.readNamedSource(
          context.bindings,
          operand,
          context,
          state,
          program,
          '$binding',
        );
      case '$event':
        state.metrics.eventReads += 1;
        this.charge(state, this.gasSchedule.values.eventRead, context);
        return this.readValuePointer(
          context.event.toSimple(),
          operand,
          context,
          state,
          program,
        );
      case '$steps':
        state.metrics.stepsReads += 1;
        this.charge(state, this.gasSchedule.values.stepsRead, context);
        return this.readSteps(context, operand, state, program);
      case '$currentContract':
        state.metrics.currentContractReads += 1;
        this.charge(
          state,
          this.gasSchedule.values.currentContractRead,
          context,
        );
        return this.readValuePointer(
          context.currentContract.toSimple(),
          operand,
          context,
          state,
          program,
        );
      case '$var':
        this.charge(state, this.gasSchedule.values.varRead, context);
        return this.readRuntimeVariable(operand, state, context, program);
      case '$const':
        return this.readConstant(operand, context, state, program);
      case '$get':
        return this.evalGet(operand, context, state, program);
      case '$changeset':
        return state.changeset.toSimple();
      case '$events':
        return state.events.toSimple();
      case '$resultValue':
        state.metrics.resultValueReads += 1;
        this.charge(state, this.gasSchedule.values.resultValueRead, context);
        return this.resultValue(operand, context, state, program);
      case '$unwrap':
        return this.unwrap(this.evalExpr(operand, context, state, program));
      case '$is':
        return this.evalIs(operand, context, state, program);
      case '$kind':
        return this.kindOf(this.evalExpr(operand, context, state, program));
      case '$isKind':
        return this.evalIsKind(operand, context, state, program);
      case '$text':
        return this.asText(this.evalExpr(operand, context, state, program));
      case '$integer':
        return this.integerResult(
          this.asIntegerBigInt(this.evalExpr(operand, context, state, program)),
        );
      case '$number':
        return this.numberResult(
          this.evalExpr(operand, context, state, program),
        );
      case '$boolean':
        return this.asBoolean(this.evalExpr(operand, context, state, program));
      case '$object': {
        const value = this.evalExpr(operand, context, state, program);
        if (value === undefined || value === null) {
          return {};
        }
        if (!this.isObject(value)) {
          throw new BexException('Value is not an object');
        }
        return value;
      }
      case '$list': {
        const value = this.evalExpr(operand, context, state, program);
        if (value === undefined || value === null) {
          return [];
        }
        if (!Array.isArray(value)) {
          throw new BexException('Value is not a list');
        }
        return value;
      }
      case '$concat':
        return this.evalListOperands(operand, context, state, program)
          .map((value) => this.asText(value))
          .join('');
      case '$pointerJoin':
        return this.pointerJoin(
          this.evalListOperands(operand, context, state, program),
        );
      case '$join':
        return this.evalJoin(operand, context, state, program);
      case '$split':
        return this.evalSplit(operand, context, state, program);
      case '$startsWith':
        return this.textPair(operand, context, state, program, (left, right) =>
          left.startsWith(right),
        );
      case '$sliceAfter':
        return this.textPair(operand, context, state, program, (left, right) =>
          left.startsWith(right) ? left.slice(right.length) : '',
        );
      case '$eq':
        return this.compareEquality(operand, context, state, program, true);
      case '$ne':
        return this.compareEquality(operand, context, state, program, false);
      case '$gt':
        return this.compareNumber(
          operand,
          context,
          state,
          program,
          (left, right) => left > right,
        );
      case '$gte':
        return this.compareNumber(
          operand,
          context,
          state,
          program,
          (left, right) => left >= right,
        );
      case '$lt':
        return this.compareNumber(
          operand,
          context,
          state,
          program,
          (left, right) => left < right,
        );
      case '$lte':
        return this.compareNumber(
          operand,
          context,
          state,
          program,
          (left, right) => left <= right,
        );
      case '$and':
        return this.evalAnd(operand, context, state, program);
      case '$or':
        return this.evalOr(operand, context, state, program);
      case '$not':
        return !this.truthy(this.evalExpr(operand, context, state, program));
      case '$truthy':
        return this.truthy(this.evalExpr(operand, context, state, program));
      case '$empty':
        return !this.truthy(this.evalExpr(operand, context, state, program));
      case '$exists':
        return this.evalExpr(operand, context, state, program) !== undefined;
      case '$coalesce':
      case '$default':
        return this.evalCoalesce(operand, context, state, program);
      case '$add':
        return this.evalNumeric(operand, context, state, program, 'add');
      case '$subtract':
        return this.evalNumeric(operand, context, state, program, 'subtract');
      case '$multiply':
        return this.evalNumeric(operand, context, state, program, 'multiply');
      case '$divide':
        return this.evalNumeric(operand, context, state, program, 'divide');
      case '$keys':
        return this.keysOf(this.evalExpr(operand, context, state, program));
      case '$entries': {
        const value = this.evalExpr(operand, context, state, program);
        return this.keysOf(value).map((key) => ({
          key,
          val: this.getKey(value, key),
        }));
      }
      case '$size':
        return this.sizeOf(this.evalExpr(operand, context, state, program));
      case '$listGet':
        return this.evalListGet(operand, context, state, program);
      case '$listConcat':
        return this.evalListConcat(operand, context, state, program);
      case '$merge':
        return this.evalMerge(operand, context, state, program);
      case '$objectSet':
        return this.evalObjectSet(operand, context, state, program);
      case '$pointerGet':
        return this.evalPointerGet(operand, context, state, program);
      case '$pointerSet':
        return this.evalPointerSet(operand, context, state, program);
      case '$choose':
        return this.evalChoose(operand, context, state, program);
      case '$map':
        return this.evalMap(operand, context, state, program);
      case '$filter':
        return this.evalFilter(operand, context, state, program);
      case '$flatMap':
        return this.evalFlatMap(operand, context, state, program);
      case '$reduce':
        return this.evalReduce(operand, context, state, program);
      case '$some':
        return this.evalSome(operand, context, state, program);
      case '$find':
        return this.evalFind(operand, context, state, program);
      case '$findEntry':
        return this.evalFindEntry(operand, context, state, program);
      case '$includes':
        return this.evalIncludes(operand, context, state, program);
      case '$hasKey':
        return this.evalHasKey(operand, context, state, program);
      case '$objectFromEntries':
        return this.evalObjectFromEntries(operand, context, state, program);
      case '$intrinsic':
        return this.evalIntrinsic(operand, context, state, program);
      case '$call':
        return this.evalCall(operand, context, state, program);
      default:
        throw new BexException(
          `Unknown BEX operator: ${operator}`,
          'compile-error',
        );
    }
  }

  private readDocument(
    context: BexExecutionContext,
    operand: unknown,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    let pointerOperand = operand;
    let view: unknown;
    if (this.isObject(operand) && 'path' in operand) {
      pointerOperand = operand.path;
      view = operand.view;
    }
    const path = this.pointerOperand(
      pointerOperand,
      context,
      state,
      program,
      false,
    );
    const documentView = context.documentView;
    if (documentView !== undefined) {
      return this.documentViewValue(documentView, view, path).toSimple();
    }
    const simple = this.documentRootSimple(context, view);
    return this.getAt(simple, this.pointerSegments(path));
  }

  private documentViewValue(
    documentView: BexDocumentView,
    view: unknown,
    path: string,
  ) {
    if (view === 'resolved') {
      return documentView.resolvedAt(path);
    }
    return documentView.canonicalAt(path);
  }

  private documentRootSimple(
    context: BexExecutionContext,
    view: unknown = undefined,
  ): unknown {
    const document =
      view === 'resolved'
        ? context.resolvedDocument
        : (context.canonicalDocument ?? context.rootDocument);
    if (view === 'resolved' && document === undefined) {
      throw new BexException(
        'Resolved document view was requested but is not available.',
      );
    }
    return document === undefined ? {} : nodeToSimple(document);
  }

  private readValuePointer(
    base: unknown,
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    const path = this.pointerOperand(operand, context, state, program, true);
    return this.getAt(base, this.pointerSegments(path));
  }

  private readNamedSource(
    bindings: Map<string, { toSimple(): unknown }>,
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
    label: string,
  ): unknown {
    if (typeof operand === 'string') {
      const slash = operand.indexOf('/');
      const name = slash >= 0 ? operand.slice(0, slash) : operand;
      const path = slash >= 0 ? operand.slice(slash) : '/';
      if (name.length === 0) {
        throw new BexException(`${label} short form requires a binding name`);
      }
      return this.getAt(
        bindings.get(name)?.toSimple(),
        this.pointerSegments(path),
      );
    }
    const spec = this.requireObject(
      operand,
      `${label} expects a binding name or object form.`,
    );
    const nameOperand =
      spec.name === undefined && label === '$binding' ? 'event' : spec.name;
    const name = this.asText(
      this.evalTextOperand(
        nameOperand,
        context,
        state,
        program,
        `${label}.name`,
      ),
    );
    const path = this.pointerOperand(
      spec.path ?? '/',
      context,
      state,
      program,
      true,
    );
    return this.getAt(
      bindings.get(name)?.toSimple(),
      this.pointerSegments(path),
    );
  }

  private readSteps(
    context: BexExecutionContext,
    operand: unknown,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    if (typeof operand === 'string') {
      const dot = operand.indexOf('.');
      const step = dot >= 0 ? operand.slice(0, dot) : operand;
      const path =
        dot >= 0 ? `/${operand.slice(dot + 1).replace(/\./g, '/')}` : '/';
      return this.getAt(
        context.steps.get(step).toSimple(),
        this.pointerSegments(path),
      );
    }
    const spec = this.requireObject(
      operand,
      '$steps expects a step name or object form.',
    );
    const step = this.asText(
      this.evalTextOperand(spec.step, context, state, program, '$steps.step'),
    );
    const path = this.pointerOperand(
      spec.path ?? '/',
      context,
      state,
      program,
      true,
    );
    return this.getAt(
      context.steps.get(step).toSimple(),
      this.pointerSegments(path),
    );
  }

  private readRuntimeVariable(
    operand: unknown,
    state: RuntimeState,
    context: BexExecutionContext,
    program: BexCompiledProgram,
  ): unknown {
    if (typeof operand === 'string') {
      return state.vars.get(operand);
    }
    const spec = this.requireObject(
      operand,
      '$var expects a variable name or object form.',
    );
    const name = this.asText(
      this.evalTextOperand(spec.name, context, state, program, '$var.name'),
    );
    const path = this.pointerOperand(
      spec.path ?? '/',
      context,
      state,
      program,
      true,
    );
    return this.getAt(state.vars.get(name), this.pointerSegments(path));
  }

  private readConstant(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    if (typeof operand === 'string') {
      return program.constants.get(operand);
    }
    const spec = this.requireObject(
      operand,
      '$const expects a constant name or object form.',
    );
    const name = this.asText(
      this.evalTextOperand(spec.name, context, state, program, '$const.name'),
    );
    const path = this.pointerOperand(
      spec.path ?? '/',
      context,
      state,
      program,
      true,
    );
    return this.getAt(program.constants.get(name), this.pointerSegments(path));
  }

  private resultValue(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    const path = this.pointerOperand(operand, context, state, program, false);
    let root: unknown = this.documentRootSimple(context);
    for (const entry of state.changeset.entriesSnapshot()) {
      root = this.pointerSet(
        root,
        this.pointerSegments(entry.path),
        entry.val,
        entry.op === 'remove',
      );
    }
    return this.getAt(root, this.pointerSegments(path));
  }

  private evalGet(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    const spec = this.requireObject(operand, '$get requires an object.');
    const object = this.evalExpr(spec.object, context, state, program);
    const key = this.asText(
      this.evalTextOperand(spec.key, context, state, program, '$get.key'),
    );
    return this.getKey(object, key);
  }

  private evalIs(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): boolean {
    const spec = this.requireObject(operand, '$is requires an object.');
    const value = this.evalExpr(spec.node, context, state, program);
    return this.matchesPattern(value, spec.pattern);
  }

  private evalIsKind(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): boolean {
    const spec = this.requireObject(operand, '$isKind requires an object.');
    const value = this.evalExpr(spec.val, context, state, program);
    return this.kindOf(value) === this.requireText(spec.kind, '$isKind.kind');
  }

  private evalIntrinsic(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    const spec = this.requireObject(
      operand,
      '$intrinsic expects an object body',
    );
    const blueId = this.intrinsicTypeBlueId(spec.type);
    if (blueId === undefined || blueId.length === 0) {
      throw new BexException('$intrinsic.type must resolve to a BlueId');
    }
    const fields = new Map<string, BexValue>();
    for (const [key, value] of Object.entries(spec)) {
      if (key === 'type') {
        continue;
      }
      const evaluated = this.evalExpr(value, context, state, program);
      if (evaluated !== undefined) {
        fields.set(key, BexValues.fromSimple(evaluated));
      }
    }
    return this.intrinsics
      .invoke(
        blueId,
        BexValues.fromSimple(spec.type),
        fields,
        (amount) => this.charge(state, amount, context),
        () => state.gasUsed,
      )
      .toSimple();
  }

  private evalJoin(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): string {
    const spec = this.requireObject(operand, '$join requires an object.');
    const list = this.evalExpr(spec.list, context, state, program);
    if (!Array.isArray(list)) {
      throw new BexException('$join list must be a list');
    }
    const separator = this.asText(
      this.evalExpr(spec.separator, context, state, program),
    );
    return list.map((item) => this.asText(item)).join(separator);
  }

  private evalSplit(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): string[] {
    const spec = this.requireObject(operand, '$split requires an object.');
    const text = this.asText(this.evalExpr(spec.text, context, state, program));
    const separator = this.asText(
      this.evalExpr(spec.separator, context, state, program),
    );
    if (separator.length === 0) {
      throw new BexException('$split separator must not be empty');
    }
    const limit =
      spec.limit === undefined
        ? -1
        : this.asInteger(this.evalExpr(spec.limit, context, state, program));
    if (limit === -1) {
      return text.split(separator);
    }
    if (limit <= 0) {
      throw new BexException('$split limit must be positive');
    }
    const parts = text.split(separator);
    if (parts.length <= limit) {
      return parts;
    }
    return [
      ...parts.slice(0, limit - 1),
      parts.slice(limit - 1).join(separator),
    ];
  }

  private textPair(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
    fn: (left: string, right: string) => unknown,
  ): unknown {
    const values = this.evalListOperands(operand, context, state, program);
    if (values.length !== 2) {
      throw new BexException('Text operator expects two operands');
    }
    return fn(this.asText(values[0]), this.asText(values[1]));
  }

  private compareEquality(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
    expectedEqual: boolean,
  ): boolean {
    const values = this.evalListOperands(operand, context, state, program);
    if (values.length !== 2) {
      throw new BexException('Comparison expects two operands');
    }
    const equal = this.valuesEqual(values[0], values[1]);
    return expectedEqual ? equal : !equal;
  }

  private compareNumber(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
    fn: (left: number, right: number) => boolean,
  ): boolean {
    const values = this.evalListOperands(operand, context, state, program);
    if (values.length !== 2) {
      throw new BexException('Comparison expects two operands');
    }
    if (this.isIntegerLike(values[0]) && this.isIntegerLike(values[1])) {
      const left = this.asIntegerBigInt(values[0]);
      const right = this.asIntegerBigInt(values[1]);
      const comparison = left === right ? 0 : left > right ? 1 : -1;
      return fn(comparison, 0);
    }
    const comparison = this.asDecimal(values[0]).cmp(this.asDecimal(values[1]));
    return fn(comparison, 0);
  }

  private evalAnd(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): boolean {
    const items = this.requireList(operand, '$and expects a list.');
    for (const item of items) {
      if (!this.truthy(this.evalExpr(item, context, state, program))) {
        return false;
      }
    }
    return true;
  }

  private evalOr(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): boolean {
    const items = this.requireList(operand, '$or expects a list.');
    for (const item of items) {
      if (this.truthy(this.evalExpr(item, context, state, program))) {
        return true;
      }
    }
    return false;
  }

  private evalCoalesce(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    const items = this.requireList(operand, '$coalesce expects a list.');
    for (const item of items) {
      const value = this.evalExpr(item, context, state, program);
      if (this.truthy(value)) {
        return value;
      }
    }
    return undefined;
  }

  private evalNumeric(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
    op: 'add' | 'subtract' | 'multiply' | 'divide',
  ): number | string {
    const values = this.evalListOperands(operand, context, state, program).map(
      (value) => this.asIntegerBigInt(value),
    );
    if (values.length === 0) {
      throw new BexException('Numeric operator needs operands');
    }
    let result = values[0];
    if (op === 'add' && values.length === 1) {
      return this.integerResult(result);
    }
    for (const next of values.slice(1)) {
      if (op === 'add') {
        result += next;
      } else if (op === 'subtract') {
        result -= next;
      } else if (op === 'multiply') {
        result *= next;
      } else {
        if (next === 0n) {
          throw new BexException('Division by zero');
        }
        if (result % next !== 0n) {
          throw new BexException('Non-exact integer division');
        }
        result /= next;
      }
    }
    return this.integerResult(result);
  }

  private evalListGet(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    const spec = this.requireObject(operand, '$listGet requires an object.');
    const list = this.evalExpr(spec.list, context, state, program);
    if (!Array.isArray(list)) {
      throw new BexException('$listGet list must be list');
    }
    const index = this.asInteger(
      this.evalExpr(spec.index, context, state, program),
    );
    if (index < 0) {
      throw new BexException('$listGet index must be non-negative');
    }
    const value = list[index];
    return value === undefined && 'default' in spec
      ? this.evalExpr(spec.default, context, state, program)
      : value;
  }

  private evalListConcat(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown[] {
    const out: unknown[] = [];
    for (const value of this.evalListOperands(
      operand,
      context,
      state,
      program,
    )) {
      if (!Array.isArray(value)) {
        throw new BexException('$listConcat operand must be list');
      }
      out.push(...value);
    }
    return out;
  }

  private evalMerge(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): SimpleObject {
    const out: SimpleObject = {};
    for (const value of this.evalListOperands(
      operand,
      context,
      state,
      program,
    )) {
      if (!this.isObject(value)) {
        throw new BexException('$merge operand must be object');
      }
      for (const key of sortBexKeys(Object.keys(value))) {
        out[key] = value[key];
      }
    }
    return out;
  }

  private evalObjectSet(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): SimpleObject {
    const spec = this.requireObject(operand, '$objectSet requires an object.');
    const object = this.evalExpr(spec.object, context, state, program);
    if (object !== undefined && object !== null && !this.isObject(object)) {
      throw new BexException('$objectSet base must be an object');
    }
    const key = this.asText(
      this.evalTextOperand(spec.key, context, state, program, '$objectSet.key'),
    );
    const value = this.evalExpr(spec.val, context, state, program);
    this.chargeValue(
      state,
      this.gasSchedule.values.objectSetBase,
      value,
      context,
    );
    const out: SimpleObject = this.isObject(object) ? { ...object } : {};
    if (value === undefined) {
      delete out[key];
    } else {
      out[key] = value;
    }
    return this.sortObject(out);
  }

  private evalPointerGet(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    const spec = this.requireObject(operand, '$pointerGet requires an object.');
    const path = this.pointerOperand(spec.path, context, state, program, true);
    const segments = this.pointerSegments(path);
    this.charge(
      state,
      this.gasSchedule.values.pointerGetBase + segments.length,
      context,
    );
    const object = this.evalExpr(spec.object, context, state, program);
    const value = this.getAt(object, segments);
    return value === undefined && 'default' in spec
      ? this.evalExpr(spec.default, context, state, program)
      : value;
  }

  private evalPointerSet(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    const spec = this.requireObject(operand, '$pointerSet requires an object.');
    const object = this.evalExpr(spec.object, context, state, program);
    const operation =
      spec.op === undefined
        ? 'set'
        : this.asText(
            this.evalTextOperand(
              spec.op,
              context,
              state,
              program,
              '$pointerSet.op',
            ),
          );
    if (operation !== 'set' && operation !== 'remove') {
      throw new BexException(`Unsupported $pointerSet op: ${operation}`);
    }
    const path = this.pointerOperand(spec.path, context, state, program, true);
    const segments = this.pointerSegments(path);
    const value =
      operation === 'remove'
        ? undefined
        : this.evalExpr(spec.val, context, state, program);
    this.chargePointerValue(
      state,
      this.gasSchedule.values.pointerSetBase,
      segments.length,
      value,
      context,
    );
    return this.pointerSet(object, segments, value, operation === 'remove');
  }

  private evalChoose(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    const spec = this.requireObject(operand, '$choose requires an object.');
    if (this.truthy(this.evalExpr(spec.cond, context, state, program))) {
      return this.evalExpr(spec.then, context, state, program);
    }
    return 'else' in spec
      ? this.evalExpr(spec.else, context, state, program)
      : undefined;
  }

  private evalMap(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown[] {
    const spec = this.requireObject(operand, '$map requires an object.');
    return this.collectionEntries(
      this.evalExpr(spec.in, context, state, program),
      '$map',
    ).map((entry) => {
      this.charge(state, this.gasSchedule.values.forEachItem, context);
      return this.withIterationBindings(state, spec, entry, () =>
        this.evalExpr(spec.expr, context, state, program),
      );
    });
  }

  private evalFilter(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown[] | SimpleObject {
    const spec = this.requireObject(operand, '$filter requires an object.');
    const input = this.evalExpr(spec.in, context, state, program);
    const entries = this.collectionEntries(input, '$filter');
    if (Array.isArray(input)) {
      const out: unknown[] = [];
      for (const entry of entries) {
        this.charge(state, this.gasSchedule.values.forEachItem, context);
        if (
          this.withIterationBindings(state, spec, entry, () =>
            this.truthy(this.evalExpr(spec.where, context, state, program)),
          )
        ) {
          out.push(this.cloneSimple(entry.val));
        }
      }
      return out;
    }
    const out: SimpleObject = {};
    for (const entry of entries) {
      this.charge(state, this.gasSchedule.values.forEachItem, context);
      if (
        this.withIterationBindings(state, spec, entry, () =>
          this.truthy(this.evalExpr(spec.where, context, state, program)),
        )
      ) {
        out[this.requireText(entry.key, '$filter.entry.key')] =
          this.cloneSimple(entry.val);
      }
    }
    return this.sortObject(out);
  }

  private evalFlatMap(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown[] {
    const spec = this.requireObject(operand, '$flatMap requires an object.');
    const out: unknown[] = [];
    for (const entry of this.collectionEntries(
      this.evalExpr(spec.in, context, state, program),
      '$flatMap',
    )) {
      this.charge(state, this.gasSchedule.values.forEachItem, context);
      const value = this.withIterationBindings(state, spec, entry, () =>
        this.evalExpr(spec.expr, context, state, program),
      );
      if (!Array.isArray(value)) {
        throw new BexException('$flatMap expr must evaluate to a list');
      }
      out.push(...value.map((item) => this.cloneSimple(item)));
    }
    return out;
  }

  private evalReduce(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    const spec = this.requireObject(operand, '$reduce requires an object.');
    const accName = this.requireText(spec.acc, '$reduce.acc');
    let acc = this.evalExpr(spec.init, context, state, program);
    for (const entry of this.collectionEntries(
      this.evalExpr(spec.in, context, state, program),
      '$reduce',
    )) {
      this.charge(state, this.gasSchedule.values.forEachItem, context);
      acc = this.withIterationBindings(
        state,
        spec,
        entry,
        () => this.evalExpr(spec.expr, context, state, program),
        { [accName]: acc },
      );
    }
    return acc;
  }

  private evalSome(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): boolean {
    const spec = this.requireObject(operand, '$some requires an object.');
    for (const entry of this.collectionEntries(
      this.evalExpr(spec.in, context, state, program),
      '$some',
    )) {
      this.charge(state, this.gasSchedule.values.forEachItem, context);
      if (
        this.withIterationBindings(state, spec, entry, () =>
          this.truthy(this.evalExpr(spec.where, context, state, program)),
        )
      ) {
        return true;
      }
    }
    return false;
  }

  private evalFind(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    const spec = this.requireObject(operand, '$find requires an object.');
    for (const entry of this.collectionEntries(
      this.evalExpr(spec.in, context, state, program),
      '$find',
    )) {
      this.charge(state, this.gasSchedule.values.forEachItem, context);
      if (
        this.withIterationBindings(state, spec, entry, () =>
          this.truthy(this.evalExpr(spec.where, context, state, program)),
        )
      ) {
        return this.cloneSimple(entry.val);
      }
    }
    return undefined;
  }

  private evalFindEntry(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    const spec = this.requireObject(operand, '$findEntry requires an object.');
    for (const entry of this.collectionEntries(
      this.evalExpr(spec.in, context, state, program),
      '$findEntry',
    )) {
      this.charge(state, this.gasSchedule.values.forEachItem, context);
      if (
        this.withIterationBindings(state, spec, entry, () =>
          this.truthy(this.evalExpr(spec.where, context, state, program)),
        )
      ) {
        return this.sortObject({
          index: entry.index,
          key: entry.key,
          val: this.cloneSimple(entry.val),
        });
      }
    }
    return undefined;
  }

  private evalIncludes(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): boolean {
    const spec = this.requireObject(operand, '$includes requires an object.');
    const list = this.evalExpr(spec.list, context, state, program);
    if (!Array.isArray(list)) {
      throw new BexException('$includes list must be a list');
    }
    const val = this.evalExpr(spec.val, context, state, program);
    return list.some((item) => this.valuesEqual(item, val));
  }

  private evalHasKey(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): boolean {
    const spec = this.requireObject(operand, '$hasKey requires an object.');
    const object = this.evalExpr(spec.object, context, state, program);
    if (!this.isObject(object)) {
      return false;
    }
    const key = this.asText(
      this.evalTextOperand(spec.key, context, state, program, '$hasKey.key'),
    );
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  private evalObjectFromEntries(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): SimpleObject {
    const entries = this.evalExpr(operand, context, state, program);
    if (!Array.isArray(entries)) {
      throw new BexException('$objectFromEntries requires a list');
    }
    const out: SimpleObject = {};
    for (const [index, entry] of entries.entries()) {
      const object = this.requireObject(
        entry,
        `$objectFromEntries entry ${index} must be an object.`,
      );
      const key = this.requireText(object.key, '$objectFromEntries.entry.key');
      if (object.val !== undefined) {
        out[key] = this.cloneSimple(object.val);
      }
    }
    return this.sortObject(out);
  }

  private evalCall(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown {
    const spec = this.requireObject(operand, '$call requires an object.');
    const functionName = this.requireText(spec.function, '$call.function');
    const definition = program.functions.get(functionName);
    if (definition === undefined) {
      throw new BexException(
        `Unknown function: ${functionName}`,
        'compile-error',
      );
    }
    this.chargeFunctionCall(state, context);
    const previousVars = state.vars;
    try {
      const frameVars = new Map<string, unknown>();
      const args = this.requireObject(
        spec.args ?? {},
        '$call.args must be an object.',
      );
      for (const argName of sortBexKeys(Object.keys(definition.args))) {
        const value = this.evalExpr(args[argName], context, state, program);
        if (!this.matchesPattern(value, definition.args[argName])) {
          throw new BexException(
            `Function argument ${argName} does not match declared Blue pattern`,
            'runtime-error',
            {
              functionName,
            },
          );
        }
        frameVars.set(argName, value);
      }
      state.vars = frameVars;
      if (definition.expr !== undefined) {
        return this.evalExpr(definition.expr, context, state, program);
      }
      try {
        return this.execBlock(definition.do, context, state, program);
      } catch (signal) {
        if (signal instanceof ReturnSignal) {
          return signal.value;
        }
        throw signal;
      }
    } catch (error) {
      if (error instanceof BexException && error.functionName === undefined) {
        throw new BexException(error.message, error.errorClass, {
          sourcePath: error.sourcePath,
          operator: error.operator,
          pointer: error.pointer,
          cause: error.cause,
          functionName,
        });
      }
      throw error;
    } finally {
      state.vars = previousVars;
    }
  }

  private evalTextOperand(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
    label: string,
  ): unknown {
    if (operand === undefined || operand === null) {
      throw new BexException(`${label} cannot be null or undefined`);
    }
    if (this.containsBex(operand)) {
      const value = this.evalExpr(operand, context, state, program);
      if (value === undefined || value === null) {
        throw new BexException(`${label} cannot be null or undefined`);
      }
      return value;
    }
    return operand;
  }

  private evalListOperands(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
  ): unknown[] {
    return this.requireList(operand, 'Operator expects a list.').map((item) =>
      this.evalExpr(item, context, state, program),
    );
  }

  private pointerOperand(
    operand: unknown,
    context: BexExecutionContext,
    state: RuntimeState,
    program: BexCompiledProgram,
    valueLocal: boolean,
  ): string {
    let pointerValue = operand;
    if (this.isObject(operand) && 'path' in operand) {
      pointerValue = operand.path;
    }
    const dynamic = this.containsBex(pointerValue);
    if (dynamic) {
      pointerValue = this.evalExpr(pointerValue, context, state, program);
    }
    const pointer = dynamic
      ? this.pointerText(pointerValue)
      : this.pointerText(pointerValue ?? '/');
    return valueLocal
      ? this.normalizeValuePointer(pointer)
      : this.resolveDocumentPointer(pointer, context);
  }

  private pointerText(value: unknown): string {
    if (value === undefined || value === null) {
      throw new BexException(
        'Pointer operand cannot be null or undefined',
        'runtime-error',
        {
          pointer: String(value),
        },
      );
    }
    return this.asText(value);
  }

  private resolveDocumentPointer(
    pointer: string,
    context: BexExecutionContext,
  ): string {
    if (pointer.startsWith('/')) {
      return this.canonicalPointer(pointer);
    }
    const scope = context.documentScope.startsWith('/')
      ? context.documentScope
      : `/${context.documentScope}`;
    const base = scope === '/' ? '' : scope.replace(/\/$/, '');
    return this.canonicalPointer(`${base}/${pointer}`);
  }

  private normalizeValuePointer(pointer: string): string {
    if (pointer.length === 0) {
      return '/';
    }
    return this.canonicalPointer(
      pointer.startsWith('/') ? pointer : `/${pointer}`,
    );
  }

  private canonicalPointer(pointer: string): string {
    const segments = this.pointerSegments(pointer);
    return segments.length === 0
      ? '/'
      : `/${segments.map((segment) => this.escapePointer(segment)).join('/')}`;
  }

  private pointerSegments(pointer: string): string[] {
    if (pointer === '' || pointer === '/') {
      return [];
    }
    const text = pointer.startsWith('/') ? pointer.slice(1) : pointer;
    if (text.length === 0) {
      return [];
    }
    return text
      .split('/')
      .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
  }

  private pointerJoin(values: unknown[]): string {
    if (values.length === 0) {
      return '/';
    }
    return `/${values
      .map((value) => {
        if (value === undefined || value === null) {
          throw new BexException(
            '$pointerJoin segment cannot be null or undefined',
          );
        }
        return this.escapePointer(this.asText(value));
      })
      .join('/')}`;
  }

  private getAt(value: unknown, segments: string[]): unknown {
    let current = value;
    for (const segment of segments) {
      current = this.getKey(current, segment);
      if (current === undefined) {
        return undefined;
      }
    }
    return current;
  }

  private getKey(value: unknown, key: string): unknown {
    if (Array.isArray(value)) {
      const index = Number(key);
      return Number.isInteger(index) && index >= 0 ? value[index] : undefined;
    }
    if (this.isObject(value)) {
      const items = value.items;
      const index = Number(key);
      if (Array.isArray(items) && Number.isInteger(index) && index >= 0) {
        return items[index];
      }
      return value[key];
    }
    return undefined;
  }

  private pointerSet(
    base: unknown,
    segments: string[],
    value: unknown,
    remove: boolean,
  ): unknown {
    if (segments.length === 0) {
      return remove ? undefined : this.cloneSimple(value);
    }
    const root = this.cloneContainer(base);
    let current = root;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      if (!this.isObject(current) && !Array.isArray(current)) {
        throw new BexException(
          '$pointerSet encountered incompatible intermediate scalar',
        );
      }
      const next = this.getKey(current, segment);
      const container = this.cloneContainer(next);
      if (Array.isArray(current)) {
        current[Number(segment)] = container;
      } else {
        current[segment] = container;
      }
      current = container;
    }
    const last = segments[segments.length - 1];
    if (Array.isArray(current)) {
      const index = Number(last);
      if (remove) {
        current[index] = undefined;
      } else {
        current[index] = this.cloneSimple(value);
      }
    } else if (this.isObject(current)) {
      if (remove) {
        delete current[last];
      } else {
        current[last] = this.cloneSimple(value);
      }
    }
    return this.sortDeep(root);
  }

  private cloneContainer(value: unknown): SimpleObject | unknown[] {
    if (Array.isArray(value)) {
      return value.map((item) => this.cloneSimple(item));
    }
    if (this.isObject(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.cloneSimple(item),
        ]),
      );
    }
    if (value === undefined || value === null) {
      return {};
    }
    throw new BexException(
      '$pointerSet encountered incompatible intermediate scalar',
    );
  }

  private unwrap(value: unknown): unknown {
    let current = value;
    while (this.isObject(current) && 'value' in current) {
      current = current.value;
    }
    return current;
  }

  private matchesPattern(value: unknown, pattern: unknown): boolean {
    if (value === undefined) {
      return false;
    }
    if (pattern === undefined || pattern === null) {
      return true;
    }
    if (!this.isObject(pattern)) {
      return true;
    }
    if ('blueId' in pattern) {
      return (
        this.isObject(value) &&
        this.isObject(value.type) &&
        value.type.blueId === pattern.blueId
      );
    }
    if ('type' in pattern) {
      const typeName = this.patternTypeName(pattern.type);
      if (typeName === 'Integer') {
        return typeof value === 'number' && Number.isInteger(value);
      }
      if (typeName === 'Double') {
        return typeof value === 'number';
      }
      if (typeName === 'Text') {
        return typeof value === 'string';
      }
      if (typeName === 'Boolean') {
        return typeof value === 'boolean';
      }
    }
    for (const [key, childPattern] of Object.entries(pattern)) {
      if (this.reservedBlueKeys().has(key)) {
        continue;
      }
      const childValue = this.getKey(value, key);
      if (this.isObject(childPattern) && this.isObject(childPattern.schema)) {
        if (childPattern.schema.required === true && childValue === undefined) {
          return false;
        }
      }
      if (
        childValue !== undefined &&
        !this.matchesPattern(childValue, childPattern)
      ) {
        return false;
      }
    }
    return true;
  }

  private patternTypeName(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }
    if (this.isObject(value)) {
      if (typeof value.value === 'string') {
        return value.value;
      }
      if (typeof value.name === 'string') {
        return value.name;
      }
    }
    return undefined;
  }

  private collectionEntries(value: unknown, label: string): CollectionEntry[] {
    if (Array.isArray(value)) {
      return value.map((val, index) => ({ index, val }));
    }
    if (this.isObject(value)) {
      return sortBexKeys(Object.keys(value)).map((key, index) => ({
        key,
        index,
        val: value[key],
      }));
    }
    throw new BexException(`${label} input must be list or object`);
  }

  private withIterationBindings<T>(
    state: RuntimeState,
    spec: SimpleObject,
    entry: CollectionEntry,
    fn: () => T,
    extraBindings: Record<string, unknown> = {},
  ): T {
    const itemName = this.requireText(spec.item, 'collection.item');
    const bindings: Record<string, unknown> = {
      [itemName]:
        entry.key === undefined || typeof spec.key === 'string'
          ? entry.val
          : { key: entry.key, val: entry.val },
      ...extraBindings,
    };
    if (typeof spec.key === 'string') {
      bindings[spec.key] = entry.key;
    }
    if (typeof spec.index === 'string') {
      bindings[spec.index] = entry.index;
    }
    return this.withBindings(state, bindings, fn);
  }

  private withBindings<T>(
    state: RuntimeState,
    bindings: Record<string, unknown>,
    fn: () => T,
  ): T {
    const previous = new Map<
      string,
      { readonly hadValue: boolean; readonly value: unknown }
    >();
    for (const [name, value] of Object.entries(bindings)) {
      previous.set(name, {
        hadValue: state.vars.has(name),
        value: state.vars.get(name),
      });
      state.vars.set(name, value);
    }
    try {
      return fn();
    } finally {
      for (const [name, saved] of previous) {
        if (saved.hadValue) {
          state.vars.set(name, saved.value);
        } else {
          state.vars.delete(name);
        }
      }
    }
  }

  private kindOf(value: unknown): string {
    if (value === undefined) {
      return 'undefined';
    }
    if (value === null) {
      return 'null';
    }
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'double';
    }
    if (typeof value === 'string') {
      return 'text';
    }
    if (Array.isArray(value)) {
      return 'list';
    }
    if (this.isObject(value)) {
      return 'object';
    }
    return typeof value;
  }

  private asText(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }
    throw new BexException('Cannot convert non-scalar BEX value to text.');
  }

  private asInteger(value: unknown): number {
    const integer = this.asIntegerBigInt(value);
    const min = BigInt(Number.MIN_SAFE_INTEGER);
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    if (integer < min || integer > max) {
      throw new BexException(
        `Integer is outside safe JavaScript range: ${String(value)}`,
      );
    }
    return Number(integer);
  }

  private asIntegerBigInt(value: unknown): bigint {
    if (typeof value === 'number' && Number.isInteger(value)) {
      if (!Number.isSafeInteger(value)) {
        throw new BexException(
          `Unsafe JavaScript integer cannot be used exactly: ${String(value)}`,
        );
      }
      return BigInt(value);
    }
    if (typeof value === 'string' && this.isIntegerText(value)) {
      return BigInt(value);
    }
    throw new BexException(`Cannot convert value to integer: ${String(value)}`);
  }

  private integerResult(value: bigint): number | string {
    const min = BigInt(Number.MIN_SAFE_INTEGER);
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    return value >= min && value <= max ? Number(value) : value.toString();
  }

  private isIntegerLike(value: unknown): boolean {
    return (
      (typeof value === 'number' &&
        Number.isInteger(value) &&
        Number.isSafeInteger(value)) ||
      (typeof value === 'string' && this.isIntegerText(value))
    );
  }

  private isIntegerText(value: string): boolean {
    return /^-?(0|[1-9]\d*)$/.test(value);
  }

  private numberResult(value: unknown): number | string {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new BexException(
          `Cannot convert value to number: ${String(value)}`,
        );
      }
      return value;
    }
    const text = this.asText(value);
    this.assertNumericText(text, value);
    if (this.isIntegerText(text)) {
      const numeric = Number(text);
      return Number.isSafeInteger(numeric) ? numeric : text;
    }
    return text;
  }

  private asDecimal(value: unknown): Big {
    const text = this.asText(value);
    this.assertNumericText(text, value);
    return new Big(text);
  }

  private assertNumericText(text: string, original: unknown): void {
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) {
      throw new BexException(
        `Cannot convert value to number: ${String(original)}`,
      );
    }
  }

  private asBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      if (value === 'true') {
        return true;
      }
      if (value === 'false') {
        return false;
      }
    }
    return this.truthy(value);
  }

  private truthy(value: unknown): boolean {
    if (
      value === undefined ||
      value === null ||
      value === false ||
      value === ''
    ) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (this.isObject(value)) {
      return Object.keys(value).length > 0;
    }
    return true;
  }

  private valuesEqual(left: unknown, right: unknown): boolean {
    if (typeof left === 'number' && typeof right === 'number') {
      return left === right;
    }
    return (
      JSON.stringify(this.sortDeep(left)) ===
      JSON.stringify(this.sortDeep(right))
    );
  }

  private keysOf(value: unknown): string[] {
    return this.isObject(value) ? sortBexKeys(Object.keys(value)) : [];
  }

  private sizeOf(value: unknown): number {
    if (value === undefined || value === null) {
      return 0;
    }
    if (Array.isArray(value)) {
      return value.length;
    }
    if (this.isObject(value)) {
      return Object.keys(value).length;
    }
    return 1;
  }

  private charge(
    state: RuntimeState,
    amount: number,
    context: BexExecutionContext,
  ): void {
    if (amount <= 0) {
      return;
    }
    state.gasUsed += amount;
    if (context.gasLimit >= 0 && state.gasUsed > context.gasLimit) {
      throw new BexException(
        `BEX gas exhausted at ${state.gasUsed} gas units`,
        'gas-exhaustion',
      );
    }
  }

  private chargeFunctionCall(
    state: RuntimeState,
    context: BexExecutionContext,
  ): void {
    state.metrics.functionCalls += 1;
    this.charge(state, this.gasSchedule.values.functionCall, context);
  }

  private chargeValue(
    state: RuntimeState,
    base: number,
    value: unknown,
    context: BexExecutionContext,
  ): void {
    this.charge(state, base + this.estimateSize(value), context);
  }

  private chargePointerValue(
    state: RuntimeState,
    base: number,
    pathSegments: number,
    value: unknown,
    context: BexExecutionContext,
  ): void {
    this.charge(
      state,
      base + Math.max(0, pathSegments) + this.estimateSize(value),
      context,
    );
  }

  private estimateSize(value: unknown): number {
    if (value === undefined || value === null) {
      return 0;
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return Math.max(1, String(value).length);
    }
    if (Array.isArray(value)) {
      return (
        value.length +
        value.reduce((sum, item) => sum + this.estimateSize(item), 0)
      );
    }
    if (this.isObject(value)) {
      return Object.entries(value).reduce(
        (sum, [key, item]) => sum + key.length + this.estimateSize(item),
        Object.keys(value).length,
      );
    }
    return Math.max(1, String(value).length);
  }

  private containsBex(value: unknown): boolean {
    if (Array.isArray(value)) {
      return value.some((item) => this.containsBex(item));
    }
    if (!this.isObject(value)) {
      return false;
    }
    if (Object.keys(value).some((key) => key.startsWith('$'))) {
      return true;
    }
    return Object.values(value).some((item) => this.containsBex(item));
  }

  private isSingleOperator(
    value: unknown,
    operator: string,
  ): value is SimpleObject {
    return (
      this.isObject(value) &&
      Object.keys(value).length === 1 &&
      Object.prototype.hasOwnProperty.call(value, operator)
    );
  }

  private patchOp(value: string): BexPatchEntry['op'] {
    if (value === 'add' || value === 'replace' || value === 'remove') {
      return value;
    }
    throw new BexException(`Unsupported patch op: ${value}`);
  }

  private requireObject(value: unknown, message: string): SimpleObject {
    if (!this.isObject(value)) {
      throw new BexException(message);
    }
    return value;
  }

  private requireList(value: unknown, message: string): unknown[] {
    if (!Array.isArray(value)) {
      throw new BexException(message);
    }
    return value;
  }

  private requireText(value: unknown, label: string): string {
    if (typeof value !== 'string') {
      throw new BexException(`Missing required text field: ${label}`);
    }
    return value;
  }

  private rejectReservedUserName(name: string, label: string): void {
    if (this.reservedBlueKeys().has(name)) {
      throw new BexException(
        `${label} contains reserved Blue key: ${name}`,
        'compile-error',
      );
    }
  }

  private reservedBlueKeys(): Set<string> {
    return new Set([
      'name',
      'description',
      'type',
      'itemType',
      'keyType',
      'valueType',
      'value',
      'items',
      'blueId',
      'blue',
      'schema',
      'constraints',
      'mergePolicy',
      'properties',
      'contracts',
      '$previous',
      '$pos',
      '$replace',
      '$empty',
    ]);
  }

  private blueWrapperKeys(): Set<string> {
    return new Set([
      'name',
      'description',
      'type',
      'itemType',
      'keyType',
      'valueType',
      'value',
      'items',
      'blueId',
      'blue',
      'schema',
      'constraints',
      'mergePolicy',
      'properties',
      'contracts',
    ]);
  }

  private statementOperators(): Set<string> {
    return new Set([
      '$let',
      '$set',
      '$if',
      '$forEach',
      '$appendChange',
      '$appendChanges',
      '$appendEvent',
      '$appendEvents',
      '$call',
      '$return',
      '$returnIf',
      '$fail',
      '$failIf',
    ]);
  }

  private expressionOperators(): Set<string> {
    return new Set([
      '$literal',
      '$null',
      '$emptyObject',
      '$emptyList',
      '$document',
      '$binding',
      '$event',
      '$steps',
      '$currentContract',
      '$var',
      '$const',
      '$get',
      '$changeset',
      '$events',
      '$resultValue',
      '$unwrap',
      '$is',
      '$kind',
      '$isKind',
      '$text',
      '$integer',
      '$number',
      '$boolean',
      '$object',
      '$list',
      '$concat',
      '$pointerJoin',
      '$join',
      '$split',
      '$startsWith',
      '$sliceAfter',
      '$eq',
      '$ne',
      '$gt',
      '$gte',
      '$lt',
      '$lte',
      '$and',
      '$or',
      '$not',
      '$truthy',
      '$empty',
      '$exists',
      '$coalesce',
      '$default',
      '$add',
      '$subtract',
      '$multiply',
      '$divide',
      '$keys',
      '$entries',
      '$size',
      '$listGet',
      '$listConcat',
      '$merge',
      '$objectSet',
      '$pointerGet',
      '$pointerSet',
      '$choose',
      '$map',
      '$filter',
      '$flatMap',
      '$reduce',
      '$some',
      '$find',
      '$findEntry',
      '$includes',
      '$hasKey',
      '$objectFromEntries',
      '$intrinsic',
      '$call',
    ]);
  }

  private escapePointer(segment: string): string {
    return segment.replace(/~/g, '~0').replace(/\//g, '~1');
  }

  private cloneSimple(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.cloneSimple(item));
    }
    if (this.isObject(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.cloneSimple(item),
        ]),
      );
    }
    return value;
  }

  private sortDeep(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortDeep(item));
    }
    if (this.isObject(value)) {
      return this.sortObject(value);
    }
    return value;
  }

  private sortObject(value: SimpleObject): SimpleObject {
    return Object.fromEntries(
      sortBexKeys(Object.keys(value))
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, this.sortDeep(value[key])]),
    );
  }

  private isObject(value: unknown): value is SimpleObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private intrinsicTypeBlueId(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (!this.isObject(value)) {
      return undefined;
    }

    const reference = value.blueId;
    if (typeof reference === 'string' && reference.trim().length > 0) {
      return reference.trim();
    }

    const scalar = value.value;
    if (typeof scalar === 'string' && scalar.trim().length > 0) {
      return scalar.trim();
    }

    try {
      return BlueIdCalculator.calculateBlueIdSync(
        BexValues.toBlueNodeStrict(value, {
          allowComputedBlue: true,
          allowConstraints: true,
        }),
      );
    } catch {
      return undefined;
    }
  }
}

export class BexEngineBuilder {
  private configuredGasSchedule = BexGasSchedule.defaults();
  private configuredIntrinsics = BexIntrinsicRegistry.empty();

  public gasScheduleOverride(gasSchedule: BexGasSchedule): this {
    this.configuredGasSchedule = gasSchedule;
    return this;
  }

  public gasScheduleValue(gasSchedule: BexGasSchedule): this {
    this.configuredGasSchedule = gasSchedule;
    return this;
  }

  public gasScheduleConfig(gasSchedule: BexGasSchedule): this {
    this.configuredGasSchedule = gasSchedule;
    return this;
  }

  public gasSchedule(gasSchedule: BexGasSchedule): this {
    this.configuredGasSchedule = gasSchedule;
    return this;
  }

  public intrinsics(intrinsics: BexIntrinsicRegistry): this {
    this.configuredIntrinsics = intrinsics;
    return this;
  }

  public intrinsic(blueId: string, processor: BexIntrinsicProcessor): this {
    this.configuredIntrinsics = this.configuredIntrinsics.with(
      blueId,
      processor,
    );
    return this;
  }

  public build(): BexEngine {
    return new BexEngine(this.configuredGasSchedule, this.configuredIntrinsics);
  }
}
