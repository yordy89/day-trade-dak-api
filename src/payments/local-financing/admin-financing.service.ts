import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/user.schema';
import { FinancingPlan, FinancingPlanDocument } from './financing-plan.schema';
import { InstallmentPlan, InstallmentPlanDocument, InstallmentPlanStatus } from './installment-plan.schema';

@Injectable()
export class AdminFinancingService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(FinancingPlan.name) private financingPlanModel: Model<FinancingPlanDocument>,
    @InjectModel(InstallmentPlan.name) private installmentPlanModel: Model<InstallmentPlanDocument>,
  ) {}

  // ========== FINANCING PLANS MANAGEMENT ==========

  async getAllFinancingPlans(active?: string) {
    const query: any = {};
    if (active === 'true') {
      query.isActive = true;
    } else if (active === 'false') {
      query.isActive = false;
    }
    
    return this.financingPlanModel
      .find(query)
      .sort({ sortOrder: 1 })
      .exec();
  }

  async getFinancingPlan(id: string) {
    const plan = await this.financingPlanModel.findById(id);
    if (!plan) {
      throw new HttpException('Financing plan not found', HttpStatus.NOT_FOUND);
    }
    return plan;
  }

  async createFinancingPlan(data: any) {
    // Check if planId already exists
    const existing = await this.financingPlanModel.findOne({ planId: data.planId });
    if (existing) {
      throw new HttpException('Plan ID already exists', HttpStatus.CONFLICT);
    }

    const plan = new this.financingPlanModel({
      ...data,
      downPaymentPercent: data.downPaymentPercent || 0,
      processingFeePercent: data.processingFeePercent || 0,
      sortOrder: data.sortOrder || 999,
      isActive: data.isActive !== false,
      autoCharge: true,
      gracePeriodDays: 3,
      lateFeeAmount: 0,
      lateFeePercent: 0,
    });

    await plan.save();
    
    return {
      message: 'Financing plan created successfully',
      plan,
    };
  }

  async updateFinancingPlan(id: string, data: any) {
    const plan = await this.financingPlanModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true },
    );

    if (!plan) {
      throw new HttpException('Financing plan not found', HttpStatus.NOT_FOUND);
    }

    return {
      message: 'Financing plan updated successfully',
      plan,
    };
  }

  async deleteFinancingPlan(id: string) {
    const plan = await this.financingPlanModel.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true },
    );

    if (!plan) {
      throw new HttpException('Financing plan not found', HttpStatus.NOT_FOUND);
    }

    return {
      message: 'Financing plan deactivated successfully',
    };
  }

  // ========== USER FINANCING APPROVAL ==========

  async getUsersWithFinancingStatus(approved?: string, search?: string) {
    const query: any = {};
    
    if (approved === 'true') {
      query.approvedForLocalFinancing = true;
    } else if (approved === 'false') {
      query.approvedForLocalFinancing = { $ne: true };
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await this.userModel
      .find(query)
      .select('firstName lastName email approvedForLocalFinancing localFinancingDetails createdAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();

    return users;
  }

  async approveUserForFinancing(userId: string, data: any, approvedBy: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    user.approvedForLocalFinancing = true;
    user.localFinancingDetails = {
      approvedBy,
      approvedAt: new Date(),
      maxAmount: data.maxAmount,
      notes: data.notes || '',
    };

    await user.save();

    return {
      message: 'User approved for local financing',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        approvedForLocalFinancing: user.approvedForLocalFinancing,
        localFinancingDetails: user.localFinancingDetails,
      },
    };
  }

  async revokeUserFinancing(userId: string, reason: string, revokedBy: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Check if user has active installment plans
    const activePlans = await this.installmentPlanModel.countDocuments({
      userId,
      status: { $in: ['pending', 'active'] },
    });

    if (activePlans > 0) {
      throw new HttpException(
        'Cannot revoke financing for user with active installment plans',
        HttpStatus.CONFLICT,
      );
    }

    user.approvedForLocalFinancing = false;
    if (user.localFinancingDetails) {
      user.localFinancingDetails.notes = 
        `Revoked by ${revokedBy} on ${new Date().toISOString()}. Reason: ${reason || 'Not specified'}`;
    }

    await user.save();

    return {
      message: 'User financing approval revoked',
    };
  }

  async updateUserFinancingDetails(userId: string, data: any) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (!user.approvedForLocalFinancing) {
      throw new HttpException('User is not approved for financing', HttpStatus.BAD_REQUEST);
    }

    if (data.maxAmount !== undefined) {
      user.localFinancingDetails.maxAmount = data.maxAmount;
    }
    if (data.notes !== undefined) {
      user.localFinancingDetails.notes = data.notes;
    }

    await user.save();

    return {
      message: 'User financing details updated',
      localFinancingDetails: user.localFinancingDetails,
    };
  }

  // ========== INSTALLMENT PLANS MONITORING ==========

  async getAllInstallmentPlans(status?: string, userId?: string, productType?: string) {
    const query: any = {};
    
    if (status) {
      query.status = status;
    }
    if (userId) {
      query.userId = userId;
    }
    if (productType) {
      query.productType = productType;
    }

    const plans = await this.installmentPlanModel
      .find(query)
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();

    return plans;
  }

  async getInstallmentPlanDetails(id: string) {
    const plan = await this.installmentPlanModel
      .findById(id)
      .populate('userId', 'firstName lastName email')
      .populate('eventId', 'name date')
      .exec();

    if (!plan) {
      throw new HttpException('Installment plan not found', HttpStatus.NOT_FOUND);
    }

    return plan;
  }

  async cancelInstallmentPlan(id: string, reason: string, cancelledBy: string) {
    const plan = await this.installmentPlanModel.findById(id);
    if (!plan) {
      throw new HttpException('Installment plan not found', HttpStatus.NOT_FOUND);
    }

    if (plan.status === 'completed' || plan.status === 'cancelled') {
      throw new HttpException(
        `Cannot cancel a plan with status: ${plan.status}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    plan.status = InstallmentPlanStatus.CANCELLED;
    plan.cancelledAt = new Date();
    plan.cancelReason = `Cancelled by admin ${cancelledBy}: ${reason}`;
    
    await plan.save();

    // TODO: Cancel the Stripe subscription
    // if (plan.stripeSubscriptionId) {
    //   await this.stripeService.cancelSubscription(plan.stripeSubscriptionId);
    // }

    return {
      message: 'Installment plan cancelled successfully',
    };
  }

  async getFinancingAnalytics() {
    const [
      totalPlans,
      activePlans,
      completedPlans,
      defaultedPlans,
      totalFinanced,
      approvedUsers,
    ] = await Promise.all([
      this.installmentPlanModel.countDocuments(),
      this.installmentPlanModel.countDocuments({ status: 'active' }),
      this.installmentPlanModel.countDocuments({ status: 'completed' }),
      this.installmentPlanModel.countDocuments({ status: 'defaulted' }),
      this.installmentPlanModel.aggregate([
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      this.userModel.countDocuments({ approvedForLocalFinancing: true }),
    ]);

    return {
      totalPlans,
      activePlans,
      completedPlans,
      defaultedPlans,
      defaultRate: totalPlans > 0 ? (defaultedPlans / totalPlans * 100).toFixed(2) + '%' : '0%',
      totalFinanced: totalFinanced[0]?.total || 0,
      approvedUsers,
    };
  }
}