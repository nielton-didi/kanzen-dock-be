import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UserModel } from '../../generated/prisma/models.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserModel => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
