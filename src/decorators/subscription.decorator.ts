import { SetMetadata } from '@nestjs/common';
import { SubscriptionPlan } from 'src/users/user.dto';

export const RequiresSubscription = (...plans: SubscriptionPlan[]) =>
  SetMetadata('subscriptionPlans', plans);
