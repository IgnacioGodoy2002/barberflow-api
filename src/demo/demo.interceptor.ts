import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import type { AuthUser } from '../common/auth-user';
import { maskForDemo } from './demo-mask';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Modo demo (se aplica a toda la API).
 * - Un usuario demo no puede modificar nada: cualquier POST/PATCH/DELETE da 403.
 * - Lo que lee le llega con los datos personales de los clientes ocultos.
 * Corre después de los guards, así que `request.user` ya está cargado.
 */
@Injectable()
export class DemoInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ method: string; user?: AuthUser }>();
    const user = request.user;

    if (!user?.isDemo) {
      return next.handle();
    }

    if (!SAFE_METHODS.has(request.method)) {
      throw new ForbiddenException(
        'Modo demo: solo lectura. Podés recorrer todo el panel, pero no guardar cambios.',
      );
    }

    return next
      .handle()
      .pipe(map((body: unknown) => maskForDemo(body, user.id)));
  }
}
