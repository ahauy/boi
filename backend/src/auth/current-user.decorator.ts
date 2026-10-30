import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './guards/jwt-auth.guard';

// User loaded and checked by JwtAuthGuard; only use on routes protected by that guard
export const CurrentUser = createParamDecorator(
  (data: string | undefined, context: ExecutionContext) => {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) return null;
    if (data === 'sub' || data === 'id') return user._id.toString();
    return data ? (user as any)[data] : user;
  },
);

