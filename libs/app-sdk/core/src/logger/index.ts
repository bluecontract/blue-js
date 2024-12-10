import { getTimestamp } from './getTimestamp';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export const LogLevelWeight = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const satisfies Record<LogLevel, number>;

export type LoggerConfig = {
  level: LogLevel;
  prefix?: string;
  showTimestamp?: boolean;
  enabled?: boolean;
};

const defaultConfig: LoggerConfig = {
  level: 'info',
  showTimestamp: true,
  enabled: process.env.NODE_ENV === 'development',
};

export class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      ...defaultConfig,
      ...config,
    };
  }

  get levelWeight() {
    return LogLevelWeight[this.config.level];
  }

  private formatMessage(message: string) {
    const { showTimestamp, prefix } = this.config;
    const timestampStr = showTimestamp ? getTimestamp() : '';
    const prefixStr = prefix ? `[${prefix}] ` : '';

    return [timestampStr, prefixStr, message].filter(Boolean).join(' ');
  }

  error(message: string, ...args: unknown[]) {
    if (!this.config.enabled) {
      return;
    }
    if (this.levelWeight >= LogLevelWeight.error) {
      console.error(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]) {
    if (!this.config.enabled) {
      return;
    }
    if (this.levelWeight >= LogLevelWeight.warn) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: unknown[]) {
    if (!this.config.enabled) {
      return;
    }
    if (this.levelWeight >= LogLevelWeight.info) {
      console.info(this.formatMessage(message), ...args);
    }
  }

  debug(message: string, ...args: unknown[]) {
    if (!this.config.enabled) {
      return;
    }
    if (this.levelWeight >= LogLevelWeight.debug) {
      console.debug(this.formatMessage(message), ...args);
    }
  }

  cloneWithConfig(config: Partial<LoggerConfig>) {
    return new Logger({
      ...this.config,
      ...config,
    });
  }
}
