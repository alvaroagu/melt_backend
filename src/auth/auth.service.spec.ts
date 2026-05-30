import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { hash as bcryptHash } from 'bcryptjs';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';

const buildUser = async () => ({
  id: 1,
  email: 'admin@melt.local',
  name: 'Admin',
  role: UserRole.ADMIN,
  isActive: true,
  createdAt: new Date('2026-05-29T12:00:00.000Z'),
  updatedAt: new Date('2026-05-29T12:00:00.000Z'),
  passwordHash: await bcryptHash('Secret123!', 10),
});

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<Pick<PrismaService, 'user' | 'authSession'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync' | 'verifyAsync'>>;
  const userFindUnique = jest.fn();
  const authSessionCreate = jest.fn();
  const authSessionFindUnique = jest.fn();
  const authSessionUpdate = jest.fn();
  const authSessionDeleteMany = jest.fn();
  const signAsync = jest.fn();
  const verifyAsync = jest.fn();

  beforeEach(() => {
    userFindUnique.mockReset();
    authSessionCreate.mockReset();
    authSessionFindUnique.mockReset();
    authSessionUpdate.mockReset();
    authSessionDeleteMany.mockReset();
    signAsync.mockReset();
    verifyAsync.mockReset();

    prisma = {
      user: { findUnique: userFindUnique },
      authSession: {
        create: authSessionCreate,
        findUnique: authSessionFindUnique,
        update: authSessionUpdate,
        deleteMany: authSessionDeleteMany,
      },
    };

    jwtService = {
      signAsync,
      verifyAsync,
    };

    service = new AuthService(
      prisma as PrismaService,
      jwtService as JwtService,
    );
  });

  it('logs in and creates an auth session', async () => {
    const user = await buildUser();

    userFindUnique.mockResolvedValue(user);
    signAsync.mockResolvedValueOnce('access-token');
    signAsync.mockResolvedValueOnce('refresh-token');
    authSessionCreate.mockResolvedValue({
      id: 'session-id',
    });

    const result = await service.login({
      email: 'ADMIN@MELT.LOCAL',
      password: 'Secret123!',
    });

    expect(userFindUnique).toHaveBeenCalledWith({
      where: { email: 'admin@melt.local' },
      select: expect.objectContaining({ passwordHash: true }),
    });
    expect(authSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1,
        refreshTokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: expect.objectContaining({
          email: 'admin@melt.local',
          role: UserRole.ADMIN,
          isActive: true,
        }),
      }),
    );
  });

  it('rejects invalid credentials', async () => {
    const user = await buildUser();
    userFindUnique.mockResolvedValue(user);

    await expect(
      service.login({
        email: 'admin@melt.local',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refreshes a valid session and rotates the tokens', async () => {
    const user = await buildUser();

    verifyAsync.mockResolvedValue({
      sub: 1,
      email: user.email,
      role: user.role,
      sid: 'session-id',
      type: 'refresh',
    });
    authSessionFindUnique.mockResolvedValue({
      id: 'session-id',
      userId: 1,
      refreshTokenHash: createHash('sha256')
        .update('refresh-token')
        .digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });
    signAsync.mockResolvedValueOnce('new-access-token');
    signAsync.mockResolvedValueOnce('new-refresh-token');
    authSessionUpdate.mockResolvedValue({});

    const result = await service.refresh('refresh-token');

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(authSessionUpdate).toHaveBeenCalledWith({
      where: { id: 'session-id' },
      data: expect.objectContaining({
        refreshTokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('removes a session on logout', async () => {
    verifyAsync.mockResolvedValue({
      sub: 1,
      email: 'admin@melt.local',
      role: UserRole.ADMIN,
      sid: 'session-id',
      type: 'refresh',
    });
    authSessionDeleteMany.mockResolvedValue({ count: 1 });

    await service.logout('refresh-token');

    expect(authSessionDeleteMany).toHaveBeenCalledWith({
      where: {
        id: 'session-id',
        userId: 1,
      },
    });
  });
});
