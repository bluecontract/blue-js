import { quickjsWasmGas } from './quickjs-wasm-gas.js';

describe('quickjsWasmGas', () => {
  it('should work', () => {
    expect(quickjsWasmGas()).toEqual('quickjs-wasm-gas');
  });
});
