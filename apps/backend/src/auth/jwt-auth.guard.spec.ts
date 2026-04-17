import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

const mockContext = (authHeader?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: authHeader } }),
    }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: jest.Mocked<Pick<JwtService, 'verify'>>;

  beforeEach(() => {
    jwtService = { verify: jest.fn() };
    guard = new JwtAuthGuard(jwtService as unknown as JwtService);
  });

  it('returns true for a valid Bearer token', () => {
    jwtService.verify.mockReturnValue({ email: 'user@example.com' });
    expect(guard.canActivate(mockContext('Bearer valid-token'))).toBe(true);
    expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
  });

  it('throws when Authorization header is missing', () => {
    expect(() => guard.canActivate(mockContext())).toThrow(UnauthorizedException);
  });

  it('throws when Authorization header does not start with Bearer', () => {
    expect(() => guard.canActivate(mockContext('Basic abc123'))).toThrow(UnauthorizedException);
  });

  it('throws when the token is invalid or expired', () => {
    jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
    expect(() => guard.canActivate(mockContext('Bearer bad-token'))).toThrow(UnauthorizedException);
  });
});
