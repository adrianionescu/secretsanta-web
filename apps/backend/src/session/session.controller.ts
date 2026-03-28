import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SessionService } from './session.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  listSessions() {
    return this.sessionService.listSessions();
  }

  @Get('latest')
  async getLatestSession() {
    const session = await this.sessionService.getLatestSession();
    return { session, found: session !== null };
  }

  @Post('generate-pairs')
  async generatePairs(@Body() body: { participants: string[] }) {
    const pairs = await this.sessionService.generatePairs(body.participants);
    return { pairs, participants: body.participants };
  }

  @Post()
  saveSession(@Body() body: { name: string; participants: string[]; pairs: string; createdAt?: string }) {
    return this.sessionService.saveSession(body.name, body.participants, body.pairs, body.createdAt);
  }

  @Delete()
  deleteAllSessions() {
    return this.sessionService.deleteAllSessions();
  }

  @Delete(':name')
  deleteSession(@Param('name') name: string) {
    return this.sessionService.deleteSession(name);
  }
}
