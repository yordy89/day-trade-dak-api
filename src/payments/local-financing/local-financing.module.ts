import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LocalFinancingService } from './local-financing.service';
import { AdminFinancingService } from './admin-financing.service';
import { LocalFinancingController } from './local-financing.controller';
import { AdminFinancingController } from './admin-financing.controller';
import { FinancingPlan, FinancingPlanSchema } from './financing-plan.schema';
import { InstallmentPlan, InstallmentPlanSchema } from './installment-plan.schema';
import { User, UserSchema } from '../../users/user.schema';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    MongooseModule.forFeature([
      { name: FinancingPlan.name, schema: FinancingPlanSchema },
      { name: InstallmentPlan.name, schema: InstallmentPlanSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [LocalFinancingController, AdminFinancingController],
  providers: [LocalFinancingService, AdminFinancingService],
  exports: [LocalFinancingService, AdminFinancingService],
})
export class LocalFinancingModule {}