export type EnvMap = Record<string, string | undefined>;

/**
 * Retrieves environment variables in a runtime-agnostic way.
 *
 * If `process.env` exists (Node), it is used. Otherwise we fall back to a
 * configurable `globalThis.__BLUE_ENV__` bag that hosts can populate when
 * running inside QuickJS or other sandboxed runtimes.
 */
export function getEnvVar(name: string): string | undefined {
  const valueFromProcess = getValueFromProcessEnv(name);
  if (valueFromProcess !== undefined) {
    return valueFromProcess;
  }

  const valueFromGlobal = getValueFromGlobalEnv(name);
  if (valueFromGlobal !== undefined) {
    return valueFromGlobal;
  }

  return undefined;
}

export function getEnvFlag(name: string): boolean {
  const raw = getEnvVar(name);
  if (!raw) return false;
  return raw === 'true' || raw === '1';
}

export interface RuntimeInfo {
  version: string;
  platform: string;
  arch: string;
}

export function getRuntimeInfo(): RuntimeInfo {
  if (typeof process === 'undefined') {
    return { version: 'unknown', platform: 'unknown', arch: 'unknown' };
  }

  const { version, platform, arch } = process as unknown as {
    version?: string;
    platform?: string;
    arch?: string;
  };

  return {
    version: version ?? 'unknown',
    platform: platform ?? 'unknown',
    arch: arch ?? 'unknown',
  };
}

function getValueFromProcessEnv(name: string): string | undefined {
  if (typeof process === 'undefined') return undefined;

  const env = (process as unknown as { env?: EnvMap }).env;
  if (!env) return undefined;

  const value = env[name];
  return typeof value === 'string' ? value : undefined;
}

function getValueFromGlobalEnv(name: string): string | undefined {
  const globalEnv = (globalThis as { __BLUE_ENV__?: EnvMap }).__BLUE_ENV__;
  if (!globalEnv) return undefined;

  const value = globalEnv[name];
  return typeof value === 'string' ? value : undefined;
}
