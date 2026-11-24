import { Injectable, type LoggerService } from '@nestjs/common';
import { CorrelationContext } from '../http/correlation-context';

@Injectable()
export class AppLogger implements LoggerService {
  constructor(private readonly context = 'OrderFlow') {}

  withContext(context: string): AppLogger {
    return new AppLogger(context);
  }

  setContext(context: string): LoggerService {
    return this.withContext(context);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, trace?: unknown, ...optionalParams: unknown[]): void {
    const details =
      trace instanceof Error
        ? { error: trace.message, stack: trace.stack }
        : trace === undefined
          ? {}
          : { trace };
    this.write('error', message, [details, ...optionalParams]);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  private write(level: string, message: unknown, optionalParams: unknown[]): void {
    const correlationId = CorrelationContext.getId();
    const meta = optionalParams.filter((param) => param !== undefined && param !== null);
    const entry = {
      level,
      context: this.context,
      timestamp: new Date().toISOString(),
      ...(correlationId === undefined ? {} : { correlationId }),
      message: String(message),
      ...(meta.length > 0 ? { meta } : {}),
    };
    const line = JSON.stringify(entry);

    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}
