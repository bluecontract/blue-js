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

export class Logger {
  private level: LogLevel;
  private levelWeight: number;
  private prefix: string;
  private showTimestamp: boolean;
  private enabled: boolean;

  constructor(config: LoggerConfig) {
    this.level = config.level;
    this.levelWeight = LogLevelWeight[this.level];
    this.prefix = config.prefix || '';
    this.showTimestamp = config.showTimestamp ?? true;
    this.enabled = config.enabled ?? process.env.NODE_ENV === 'development';
  }

  private formatMessage(message: string): string {
    const timestampStr = this.showTimestamp ? getTimestamp() : '';
    const prefixStr = this.prefix ? `[${this.prefix}] ` : '';

    return [timestampStr, prefixStr, message].filter(Boolean).join(' ');
  }

  error(message: string, ...args: unknown[]): void {
    if (!this.enabled) {
      return;
    }
    if (this.levelWeight >= LogLevelWeight.error) {
      console.error(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (!this.enabled) {
      return;
    }
    if (this.levelWeight >= LogLevelWeight.warn) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (!this.enabled) {
      return;
    }
    if (this.levelWeight >= LogLevelWeight.info) {
      console.info(this.formatMessage(message), ...args);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (!this.enabled) {
      return;
    }
    if (this.levelWeight >= LogLevelWeight.debug) {
      console.debug(this.formatMessage(message), ...args);
    }
  }
}
