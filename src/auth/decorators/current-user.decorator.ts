import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthTokenPayload } from '../auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthTokenPayload }>();

    return request.user;
  },
);
