import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ModulePermission,
  ModulePermissionSchema,
} from './module-permission.schema';
import { ModulePermissionsService } from './module-permissions.service';
import { ModulePermissionsController } from './module-permissions.controller';
import { UsersModule } from '../users/users.module';
import { User, UserSchema } from '../users/user.schema';
import { LoggerModule } from '../logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { EventRegistration, EventRegistrationSchema } from '../event/schemas/eventRegistration.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ModulePermission.name, schema: ModulePermissionSchema },
      { name: User.name, schema: UserSchema },
      { name: EventRegistration.name, schema: EventRegistrationSchema },
    ]),
    forwardRef(() => UsersModule),
    LoggerModule,
    AuthModule,
    EmailModule,
  ],
  controllers: [ModulePermissionsController],
  providers: [ModulePermissionsService],
  exports: [ModulePermissionsService],
})
export class ModulePermissionsModule {}
