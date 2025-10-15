import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Sid = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();

    const user = request.user;

    if (user && typeof user === 'object' && 'sid' in user) {
      return user.sid as string;
    }
    return null;
  },
);
