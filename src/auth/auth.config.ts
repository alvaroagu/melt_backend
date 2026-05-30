import type { JwtSignOptions } from '@nestjs/jwt';

const DEFAULT_ACCESS_TOKEN_TTL = '15m';
const DEFAULT_REFRESH_TOKEN_TTL = '7d';
const DEFAULT_ACCESS_TOKEN_SECRET = 'melt-development-access-secret';
const DEFAULT_REFRESH_TOKEN_SECRET = 'melt-development-refresh-secret';

function parseDurationToMilliseconds(value: string | number) {
  const trimmedValue = String(value).trim();

  if (/^\d+$/.test(trimmedValue)) {
    return Number(trimmedValue) * 1000;
  }

  const match = /^(\d+)([smhd])$/i.exec(trimmedValue);

  if (!match) {
    throw new Error(`Invalid duration value: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplierByUnit = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  } satisfies Record<string, number>;

  return amount * multiplierByUnit[unit];
}

export function getAuthConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const sharedSecret = process.env.JWT_SECRET;
  const accessTokenSecret =
    process.env.JWT_ACCESS_SECRET ??
    sharedSecret ??
    (isProduction ? undefined : DEFAULT_ACCESS_TOKEN_SECRET);
  const refreshTokenSecret =
    process.env.JWT_REFRESH_SECRET ??
    sharedSecret ??
    (isProduction ? undefined : DEFAULT_REFRESH_TOKEN_SECRET);

  if (!accessTokenSecret || !refreshTokenSecret) {
    throw new Error(
      'JWT secrets are not configured. Set JWT_SECRET or both JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.',
    );
  }

  const accessTokenTtl = (process.env.JWT_ACCESS_EXPIRES_IN ??
    DEFAULT_ACCESS_TOKEN_TTL) as NonNullable<JwtSignOptions['expiresIn']>;
  const refreshTokenTtl = (process.env.JWT_REFRESH_EXPIRES_IN ??
    DEFAULT_REFRESH_TOKEN_TTL) as NonNullable<JwtSignOptions['expiresIn']>;

  return {
    accessTokenSecret,
    refreshTokenSecret,
    accessTokenTtl,
    refreshTokenTtl,
    accessTokenTtlMs: parseDurationToMilliseconds(accessTokenTtl),
    refreshTokenTtlMs: parseDurationToMilliseconds(refreshTokenTtl),
    secureCookies: isProduction,
  };
}
