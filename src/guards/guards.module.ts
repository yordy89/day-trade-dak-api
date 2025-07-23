import { Global, Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth-guard';
import { RolesGuard } from './roles.guard';
import { ModuleAccessGuard } from './module-access.guard';
import { UsersModule } from '../users/users.module';
import { ModulePermissionsModule } from '../module-permissions/module-permissions.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Global()
@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => ModulePermissionsModule),
    forwardRef(() => SubscriptionsModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'yourSecretKey',
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  providers: [JwtAuthGuard, RolesGuard, ModuleAccessGuard],
  exports: [JwtAuthGuard, RolesGuard, ModuleAccessGuard],
})
export class GuardsModule {}