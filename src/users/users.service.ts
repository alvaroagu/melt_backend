import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PASSWORD_SALT_ROUNDS } from '../auth/auth.constants';

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        email: this.normalizeEmail(createUserDto.email),
        name: this.normalizeName(createUserDto.name),
        passwordHash: await hash(createUserDto.password, PASSWORD_SALT_ROUNDS),
        role: createUserDto.role ?? UserRole.USER,
        isActive: createUserDto.isActive ?? true,
      },
      select: publicUserSelect,
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: publicUserSelect,
    });
  }

  findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const data: Prisma.UserUpdateInput = {};

    if (updateUserDto.email !== undefined) {
      data.email = this.normalizeEmail(updateUserDto.email);
    }

    if (updateUserDto.name !== undefined) {
      data.name = this.normalizeName(updateUserDto.name);
    }

    if (updateUserDto.password !== undefined) {
      data.passwordHash = await hash(
        updateUserDto.password,
        PASSWORD_SALT_ROUNDS,
      );
    }

    if (updateUserDto.role !== undefined) {
      data.role = updateUserDto.role;
    }

    if (updateUserDto.isActive !== undefined) {
      data.isActive = updateUserDto.isActive;
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: publicUserSelect,
    });
  }

  remove(id: number) {
    return this.prisma.user.delete({
      where: { id },
      select: publicUserSelect,
    });
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private normalizeName(name?: string) {
    const trimmedName = name?.trim();
    return trimmedName ? trimmedName : null;
  }
}
