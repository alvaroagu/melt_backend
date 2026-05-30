import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE, IS_PUBLIC_KEY } from '../auth.constants';
import { getAuthConfig } from '../auth.config';
import type { AuthTokenPayload } from '../auth.types';

type RequestWithCookies = Omit<Request, 'cookies'> & {
  cookies?: Record<string, string | undefined>;
  user?: AuthTokenPayload;
};

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly authConfig = getAuthConfig();

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithCookies>();
    const token =
      request.cookies?.[ACCESS_TOKEN_COOKIE] ?? this.getBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Debes iniciar sesión.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(
        token,
        {
          secret: this.authConfig.accessTokenSecret,
        },
      );

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Token inválido.');
      }

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Tu sesión no es válida.');
    }
  }

  private getBearerToken(request: Pick<Request, 'headers'>) {
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      return undefined;
    }

    return authorizationHeader.slice('Bearer '.length);
  }
}
