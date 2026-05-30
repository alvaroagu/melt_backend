import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import type { AuthTokenPayload } from './auth.types';
import { REFRESH_TOKEN_COOKIE } from './auth.constants';

type RequestWithCookies = Omit<Request, 'cookies'> & {
  cookies?: Record<string, string | undefined>;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.login(loginDto);

    this.authService.setAuthCookies(response, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });

    return { user: session.user };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      this.authService.clearAuthCookies(response);
      throw new UnauthorizedException('Tu sesión expiró.');
    }

    const session = await this.authService.refresh(refreshToken);

    this.authService.setAuthCookies(response, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });

    return { user: session.user };
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE];

    if (refreshToken) {
      try {
        await this.authService.logout(refreshToken);
      } finally {
        this.authService.clearAuthCookies(response);
      }
    } else {
      this.authService.clearAuthCookies(response);
    }
    return { success: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthTokenPayload) {
    return this.authService.getCurrentUser(user.sub);
  }
}
