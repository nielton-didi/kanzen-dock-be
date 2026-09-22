import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { UsersService } from '../users/users.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly usersService: UsersService,
  ) {}

  async register(dto: RegisterDto) {
    const { data, error } = await this.supabase.client.auth.signUp({
      email: dto.email,
      password: dto.password,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const user = data.user
      ? await this.usersService.getOrCreateFromSupabaseUser(data.user)
      : null;

    return { user, session: data.session };
  }

  async login(dto: LoginDto) {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    const user = await this.usersService.getOrCreateFromSupabaseUser(data.user);

    return { user, session: data.session };
  }

  /** Verifies a Supabase access token against the Supabase Auth server. */
  async validateToken(token: string): Promise<SupabaseUser> {
    const { data, error } = await this.supabase.adminClient.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid token');
    }

    return data.user;
  }
}
