import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AffiliateController } from './affiliate.controller';
import { AffiliateService } from './affiliate.service';
import { Affiliate, AffiliateSchema } from './schemas/affiliate.schema';
import { Commission, CommissionSchema } from './schemas/commission.schema';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Affiliate.name, schema: AffiliateSchema },
      { name: Commission.name, schema: CommissionSchema },
    ]),
    forwardRef(() => UsersModule),
    AuthModule,
    PermissionsModule,
  ],
  controllers: [AffiliateController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}