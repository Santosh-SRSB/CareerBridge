import { LoggerService, Injectable } from '@nestjs/common';

/**
 * CloudJsonLogger formats all logs as structured JSON single-line strings.
 * This is automatically parsed by Google Cloud Logging (Stackdriver) and assigns
 * proper severity levels, timestamps, and contextual metadata without complex log agents.
 * (Volume 2 HLD Section 2C.27 & Section 38.3)
 */
@Injectable()
export class CloudJsonLogger implements LoggerService {
  private formatMessage(level: string, message: any, context?: string, extra?: any): string {
    const timestamp = new Date().toISOString();
    const severityMap: Record<string, string> = {
      log: 'INFO',
      error: 'ERROR',
      warn: 'WARNING',
      debug: 'DEBUG',
      verbose: 'DEBUG',
    };

    let logObject: Record<string, any> = {
      severity: severityMap[level] || 'INFO',
      time: timestamp,
      context: context || 'Application',
    };

    if (typeof message === 'object' && message !== null) {
      logObject = { ...logObject, ...message };
    } else {
      try {
        const parsed = JSON.parse(message);
        if (typeof parsed === 'object' && parsed !== null) {
          logObject = { ...logObject, ...parsed };
        } else {
          logObject.message = message;
        }
      } catch {
        logObject.message = message;
      }
    }

    if (extra) {
      logObject.extra = extra;
    }

    // In local development, format cleanly if preferred, otherwise structured JSON
    return JSON.stringify(logObject);
  }

  log(message: any, context?: string) {
    console.log(this.formatMessage('log', message, context));
  }

  error(message: any, trace?: string, context?: string) {
    console.error(this.formatMessage('error', message, context, trace ? { trace } : undefined));
  }

  warn(message: any, context?: string) {
    console.warn(this.formatMessage('warn', message, context));
  }

  debug(message: any, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  verbose(message: any, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(this.formatMessage('verbose', message, context));
    }
  }
}
