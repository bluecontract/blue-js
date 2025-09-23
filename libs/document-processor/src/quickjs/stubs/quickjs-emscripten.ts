export async function newQuickJSAsyncWASMModule(): Promise<never> {
  throw new Error('quickjs-emscripten is not available inside the QuickJS bundle.');
}

export class QuickJSAsyncContext {}
export class QuickJSAsyncRuntime {}
export class QuickJSAsyncWASMModule {}
export class QuickJSHandle {}
