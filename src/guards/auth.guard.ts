import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtCookieGuard implements CanActivate {
  constructor(private cfg: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const cookieName = this.cfg.get('COOKIE_NAME') ?? 'ghdash.sid';
    const token = req.cookies?.[cookieName];
    if (!token) throw new UnauthorizedException('Missing auth cookie');
    try {
      req.user = jwt.verify(token, this.cfg.get<string>('JWT_SECRET')!);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid/expired session');
    }
  }
}
