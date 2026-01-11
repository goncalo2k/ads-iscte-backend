import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, map, throwError } from 'rxjs';

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

@Injectable()
export class HttpLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { originalUrl?: string }>();
    const res = http.getResponse<{ statusCode?: number }>();

    const method = (req as any)?.method;
    const url = (req as any)?.originalUrl ?? (req as any)?.url;

    const start = process.hrtime.bigint();

    return next.handle().pipe(
      map((data) => {
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1_000_000;

        // Note: in an interceptor, res.statusCode is usually set by now
        const status = (res as any)?.statusCode ?? 'unknown';
        if (data) {
          // Avoid huge logs
          const raw = safeJson(data);
          const body = raw.length > 2000 ? raw.slice(0, 2000) + '…(truncated)' : raw;

          this.logger.log(`${method} ${url} -> ${status} (${ms.toFixed(1)}ms) body=${body}`);
        }
        return data;
      }),
      catchError((err) => {
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1_000_000;

        const status = (err?.status ?? err?.statusCode ?? (res as any)?.statusCode ?? 500);
        const msg = err?.message ?? String(err);

        this.logger.error(`${method} ${url} -> ${status} (${ms.toFixed(1)}ms) error=${msg}`, err?.stack);
        return throwError(() => err);
      }),
    );
  }
}
