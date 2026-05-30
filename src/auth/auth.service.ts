import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { compare } from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import type { CookieOptions, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth.constants';
import { getAuthConfig } from './auth.config';
import { LoginDto } from './dto/login.dto';
import type {
  AuthenticatedUser,
  AuthTokenPayload,
  AuthTokenType,
} from './auth.types';

const authUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
} satisfies Prisma.UserSelect;

type UserRecord = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;

@Injectable()
export class AuthService {
  private readonly authConfig = getAuthConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const email = this.normalizeEmail(loginDto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: authUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    await this.assertPassword(loginDto.password, user.passwordHash);
    this.assertUserIsActive(user);

    const sessionId = randomUUID();
    const tokens = await this.issueTokens(user, sessionId);

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + this.authConfig.refreshTokenTtlMs),
      },
    });

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          select: authUserSelect,
        },
      },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('La sesión no existe.');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.authSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('La sesión expiró.');
    }

    this.assertUserIsActive(session.user);

    if (session.refreshTokenHash !== this.hashToken(refreshToken)) {
      await this.prisma.authSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('La sesión no es válida.');
    }

    const tokens = await this.issueTokens(session.user, session.id);

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + this.authConfig.refreshTokenTtlMs),
      },
    });

    return {
      user: this.sanitizeUser(session.user),
      ...tokens,
    };
  }

  async logout(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);

    await this.prisma.authSession.deleteMany({
      where: {
        id: payload.sid,
        userId: payload.sub,
      },
    });
  }

  async getCurrentUser(userId: number): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: authUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException('Tu sesión no es válida.');
    }

    this.assertUserIsActive(user);
    return this.sanitizeUser(user);
  }

  setAuthCookies(
    response: Response,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    response.cookie(
      ACCESS_TOKEN_COOKIE,
      tokens.accessToken,
      this.getCookieOptions(this.authConfig.accessTokenTtlMs),
    );
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      tokens.refreshToken,
      this.getCookieOptions(this.authConfig.refreshTokenTtlMs),
    );
  }

  clearAuthCookies(response: Response) {
    response.clearCookie(ACCESS_TOKEN_COOKIE, this.getCookieOptions(0));
    response.clearCookie(REFRESH_TOKEN_COOKIE, this.getCookieOptions(0));
  }

  private async assertPassword(
    candidatePassword: string,
    passwordHash: string,
  ) {
    const isValidPassword = await compare(candidatePassword, passwordHash);

    if (!isValidPassword) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
  }

  private assertUserIsActive(user: Pick<UserRecord, 'isActive'>) {
    if (!user.isActive) {
      throw new ForbiddenException('La cuenta se encuentra desactivada.');
    }
  }

  private sanitizeUser(user: UserRecord): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async issueTokens(user: UserRecord, sessionId: string) {
    const accessToken = await this.signToken(user, sessionId, 'access');
    const refreshToken = await this.signToken(user, sessionId, 'refresh');

    return {
      accessToken,
      refreshToken,
    };
  }

  private async signToken(
    user: Pick<UserRecord, 'id' | 'email' | 'role'>,
    sessionId: string,
    type: AuthTokenType,
  ) {
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
      type,
    };

    return this.jwtService.signAsync(payload, {
      secret:
        type === 'access'
          ? this.authConfig.accessTokenSecret
          : this.authConfig.refreshTokenSecret,
      expiresIn:
        type === 'access'
          ? this.authConfig.accessTokenTtl
          : this.authConfig.refreshTokenTtl,
    });
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(
        refreshToken,
        {
          secret: this.authConfig.refreshTokenSecret,
        },
      );

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Token inválido.');
      }

      return payload;
    } catch (error) {
      void error;
      throw new UnauthorizedException('Tu sesión expiró.');
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private getCookieOptions(maxAge: number): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.authConfig.secureCookies,
      maxAge,
      path: '/',
    };
  }
}
