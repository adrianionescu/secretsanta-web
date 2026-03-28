import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google')
  async googleAuth(@Body() body: { idToken: string }) {
    if (!body.idToken) throw new UnauthorizedException('idToken is required');
    const accessToken = await this.authService.verifyGoogleToken(body.idToken);
    return { accessToken };
  }
}
