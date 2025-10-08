import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth-controller/auth.controller';
import { AuthService } from './services/auth/auth.service';
import { ConfigModule } from '@nestjs/config';
import { redisProvider } from './providers/redis.provider';
import { GithubController } from './controllers/github-controller/github.controller';
import { TokenStoreService } from './services/token-store/token-store.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }),],
  controllers: [AuthController, GithubController],
  providers: [AuthService, TokenStoreService, redisProvider],
})
export class AppModule { }
