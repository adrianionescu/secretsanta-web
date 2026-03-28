import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AuthService {
  private readonly client: OAuth2Client;
  private readonly allowedEmails: Set<string>;

  constructor(private readonly jwtService: JwtService) {
    this.client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    this.allowedEmails = this.loadAllowedEmails();
  }

  private loadAllowedEmails(): Set<string> {
    const filePath = process.env.ALLOWED_EMAILS_PATH
      ? path.resolve(process.env.ALLOWED_EMAILS_PATH)
      : path.join(process.cwd(), 'allowed-emails.txt');

    const content = fs.readFileSync(filePath, 'utf-8');
    const emails = content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#'));

    return new Set(emails);
  }

  async verifyGoogleToken(idToken: string): Promise<string> {
    let email: string;

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      email = ticket.getPayload()?.email ?? '';
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!email || !this.allowedEmails.has(email)) {
      throw new UnauthorizedException('Email not allowed');
    }

    return this.jwtService.sign({ email });
  }
}
