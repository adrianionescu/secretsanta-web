import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { OAuth2Client } from 'google-auth-library';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
}));

import * as fs from 'fs';

const ALLOWED_EMAIL = 'allowed@example.com';
const ALLOWED_EMAILS_FILE = `# comment\n${ALLOWED_EMAIL}\n`;

const mockReadFileSync = fs.readFileSync as jest.Mock;

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;

  beforeEach(async () => {
    mockReadFileSync.mockReturnValue(ALLOWED_EMAILS_FILE);

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('signed-jwt') } },
      ],
    }).compile();

    service = module.get(AuthService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('verifyGoogleToken', () => {
    it('returns a JWT for a valid token from an allowed email', async () => {
      jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({ email: ALLOWED_EMAIL }),
      } as never);

      const result = await service.verifyGoogleToken('valid-token');
      expect(result).toBe('signed-jwt');
      expect(jwtService.sign).toHaveBeenCalledWith({ email: ALLOWED_EMAIL });
    });

    it('throws UnauthorizedException when Google rejects the token', async () => {
      jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockRejectedValue(new Error('bad') as never);

      await expect(service.verifyGoogleToken('bad-token'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when email is not in the allowlist', async () => {
      jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({ email: 'stranger@example.com' }),
      } as never);

      await expect(service.verifyGoogleToken('valid-token'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when payload has no email', async () => {
      jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({}),
      } as never);

      await expect(service.verifyGoogleToken('valid-token'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('loadAllowedEmails', () => {
    it('ignores comment lines and blank lines', async () => {
      mockReadFileSync.mockReturnValue('# ignored\n\nonly@example.com\n');

      const module = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('jwt') } },
        ],
      }).compile();

      const svc = module.get(AuthService);

      jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({ email: 'only@example.com' }),
      } as never);

      await expect(svc.verifyGoogleToken('t')).resolves.toBe('jwt');
    });
  });
});
