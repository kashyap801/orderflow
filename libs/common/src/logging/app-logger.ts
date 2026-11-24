import { Injectable, Logger, type LoggerService } from '@nestjs/common';
import { CorrelationContext } from '../http/correlation-context';

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger = new Logger();

  constructor(private readonly context = 'OrderFlow') {}

  withContext(context: string): AppLogger {
    return new AppLogger(context);
  }

  setContext(context: string): LoggerService {
    return this.withContext(context);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.log(this.format(message, optionalParams), this.context);
  }

  error(message: unknown, trace?: unknown, ...optionalParams: unknown[]): void {
    const details =
      trace instanceof Error
        ? { error: trace.message, stack: trace.stack }
        : trace === undefined
          ? {}
          : { trace };
    this.logger.error(this.format(message, [details, ...optionalParams]), this.context);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.warn(this.format(message, optionalParams), this.context);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug(this.format(message, optionalParams), this.context);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.verbose(this.format(message, optionalParams), this.context);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.fatal(this.format(message, optionalParams), this.context);
  }

  private format(message: unknown, optionalParams: unknown[]): string {
    const correlationId = CorrelationContext.getId();
    const meta = optionalParams.filter((param) => param !== undefined && param !== null);
    const payload = {
      ...(correlationId === undefined ? {} : { correlationId }),
      ...(meta.length > 0 ? { meta } : {}),
    };
    return `${String(message)} ${JSON.stringify(payload)}`;
  }
}
