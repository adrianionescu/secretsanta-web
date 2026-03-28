import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SessionModule } from '../session/session.module';
import { RepositoryModule } from '../repository/repository.module';
import { AuthModule } from '../auth/auth.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RepositoryModule.forRoot(),
    AuthModule,
    SessionModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
