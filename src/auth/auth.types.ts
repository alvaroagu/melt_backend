import { UserRole } from '@prisma/client';

export type AuthTokenType = 'access' | 'refresh';

export interface AuthTokenPayload {
  sub: number;
  email: string;
  role: UserRole;
  sid: string;
  type: AuthTokenType;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
