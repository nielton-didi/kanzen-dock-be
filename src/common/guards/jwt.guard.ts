import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../auth/auth.service.js';
import { UsersService } from '../../users/users.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token: string | undefined = request.headers.authorization?.replace(
      'Bearer ',
      '',
    );

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    const supabaseUser = await this.authService.validateToken(token);
    request.user =
      await this.usersService.getOrCreateFromSupabaseUser(supabaseUser);

    return true;
  }
}
