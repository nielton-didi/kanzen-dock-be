import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { UserModel } from '../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserModel | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<UserModel | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async getOrCreateFromSupabaseUser(
    supabaseUser: SupabaseUser,
  ): Promise<UserModel> {
    if (!supabaseUser.email) {
      throw new UnauthorizedException('Supabase user has no email');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: supabaseUser.email },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.user.create({
      data: {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: supabaseUser.user_metadata?.name,
        avatar_url: supabaseUser.user_metadata?.avatar_url,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<UserModel> {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
  }
}
