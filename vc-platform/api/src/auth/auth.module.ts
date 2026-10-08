import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CLOCK, type Clock } from '../common/clock';
import { ENV, type Env } from '../config/env';
import { AuthGuard } from './auth.guard';
import { MeController } from './me.controller';
import { TOKEN_VERIFIER, TokenVerifier } from './token-verifier';
import { ViewerService } from './viewer';

@Global()
@Module({
  controllers: [MeController],
  providers: [
    ViewerService,
    {
      provide: TOKEN_VERIFIER,
      // Without an issuer (dev without Keycloak) every protected route answers 401.
      useFactory: (env: Env, clock: Clock) => (env.OIDC_ISSUER ? new TokenVerifier(env.OIDC_ISSUER, env.OIDC_AUDIENCE, clock) : null),
      inject: [ENV, CLOCK],
    },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [ViewerService],
})
export class AuthModule {}
