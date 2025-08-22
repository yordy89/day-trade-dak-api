import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Affiliate, AffiliateDocument } from './schemas/affiliate.schema';
import { Commission, CommissionDocument } from './schemas/commission.schema';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AffiliateService {
  private stripe: Stripe;

  constructor(
    @InjectModel(Affiliate.name)
    private affiliateModel: Model<AffiliateDocument>,
    @InjectModel(Commission.name)
    private commissionModel: Model<CommissionDocument>,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
      { apiVersion: '2025-01-27.acacia' },
    );
  }

  async validateCode(code: string, eventType?: string) {
    // Only allow for master_course events
    if (eventType && eventType !== 'master_course') {
      return { 
        valid: false,
        message: 'Referral codes are only valid for Master Course'
      };
    }

    // Normalize code to uppercase
    const normalizedCode = code.toUpperCase().trim();

    if (!normalizedCode) {
      return { 
        valid: false,
        message: 'Please enter a valid referral code'
      };
    }

    try {
      const affiliate = await this.affiliateModel.findOne({
        affiliateCode: normalizedCode,
        isActive: true,
      });

      if (!affiliate) {
        return { 
          valid: false,
          message: 'Invalid or inactive referral code'
        };
      }

      // Calculate discount based on type
      let discountMessage = '';
      let discountValue = 0;
      
      if (affiliate.discountType === 'percentage') {
        discountValue = affiliate.discountPercentage || 0;
        discountMessage = `${discountValue}% discount`;
      } else {
        discountValue = affiliate.discountFixedAmount || 0;
        discountMessage = `$${discountValue} off`;
      }

      return {
        valid: true,
        discountType: affiliate.discountType,
        discountPercentage: affiliate.discountPercentage,
        discountFixedAmount: affiliate.discountFixedAmount,
        discount: discountValue, // Keep for backward compatibility
        affiliateName: affiliate.name,
        affiliateId: affiliate._id.toString(),
        affiliateCode: affiliate.affiliateCode,
        commissionType: affiliate.commissionType,
        commissionRate: affiliate.commissionRate,
        commissionFixedAmount: affiliate.commissionFixedAmount,
        stripePromotionCode: affiliate.stripePromotionCodeId,
        message: `Referral code applied! ${discountMessage}`
      };
    } catch (error) {
      console.error('Error validating referral code:', error);
      return { 
        valid: false,
        message: 'Error validating referral code'
      };
    }
  }

  async createAffiliate(data: {
    affiliateCode: string;
    name: string;
    email: string;
    phoneNumber?: string;
    discountType?: 'percentage' | 'fixed';
    discountPercentage?: number;
    discountFixedAmount?: number;
    commissionType?: 'percentage' | 'fixed';
    commissionRate?: number;
    commissionFixedAmount?: number;
  }) {
    try {
      // Normalize data
      const normalizedData = {
        ...data,
        affiliateCode: data.affiliateCode.toUpperCase().trim(),
        email: data.email.toLowerCase().trim(),
      };

      // Check if affiliate code already exists
      const existing = await this.affiliateModel.findOne({
        $or: [
          { affiliateCode: normalizedData.affiliateCode },
          { email: normalizedData.email }
        ]
      });

      if (existing) {
        throw new BadRequestException('Affiliate code or email already exists');
      }

      // Validate discount values based on type
      const discountType = normalizedData.discountType || 'percentage';
      if (discountType === 'percentage') {
        if (!normalizedData.discountPercentage || normalizedData.discountPercentage <= 0 || normalizedData.discountPercentage > 50) {
          throw new BadRequestException('Discount percentage must be between 1 and 50');
        }
      } else {
        if (!normalizedData.discountFixedAmount || normalizedData.discountFixedAmount <= 0) {
          throw new BadRequestException('Fixed discount amount must be greater than 0');
        }
        // Ensure fixed amount doesn't exceed the Master Course price
        if (normalizedData.discountFixedAmount >= 2999.99) {
          throw new BadRequestException('Fixed discount cannot exceed the course price');
        }
      }

      // Validate commission values based on type
      const commissionType = normalizedData.commissionType || 'percentage';
      if (commissionType === 'percentage') {
        if (!normalizedData.commissionRate || normalizedData.commissionRate <= 0 || normalizedData.commissionRate > 50) {
          throw new BadRequestException('Commission percentage must be between 1 and 50');
        }
      } else {
        if (!normalizedData.commissionFixedAmount || normalizedData.commissionFixedAmount <= 0) {
          throw new BadRequestException('Fixed commission amount must be greater than 0');
        }
        // Ensure commission doesn't exceed reasonable limits
        if (normalizedData.commissionFixedAmount >= 1000) {
          throw new BadRequestException('Fixed commission cannot exceed $1,000 per sale');
        }
      }

      // Create Stripe coupon for this affiliate
      let stripeCouponId: string | undefined;
      let stripePromotionCodeId: string | undefined;

      try {
        // Create a coupon in Stripe based on discount type
        const couponParams: any = {
          duration: 'once',
          id: `AFFILIATE_${normalizedData.affiliateCode}`,
          metadata: {
            affiliateCode: normalizedData.affiliateCode,
            affiliateName: normalizedData.name,
            type: 'affiliate_discount',
            discountType: discountType,
          },
        };

        if (discountType === 'percentage') {
          couponParams.percent_off = normalizedData.discountPercentage;
        } else {
          couponParams.amount_off = Math.round(normalizedData.discountFixedAmount * 100); // Stripe uses cents
          couponParams.currency = 'usd';
        }

        const coupon = await this.stripe.coupons.create(couponParams);
        stripeCouponId = coupon.id;

        // Create a promotion code that uses this coupon
        const promotionCode = await this.stripe.promotionCodes.create({
          coupon: coupon.id,
          code: normalizedData.affiliateCode,
          metadata: {
            affiliateCode: normalizedData.affiliateCode,
            affiliateName: normalizedData.name,
          },
        });
        stripePromotionCodeId = promotionCode.id;

        console.log(`Created Stripe coupon ${stripeCouponId} and promotion code ${stripePromotionCodeId} for affiliate ${normalizedData.affiliateCode}`);
      } catch (stripeError) {
        console.error('Error creating Stripe coupon/promotion code:', stripeError);
        // Continue without Stripe integration
      }

      // Clean the data based on types - only save relevant fields
      const cleanedData: any = {
        affiliateCode: normalizedData.affiliateCode,
        name: normalizedData.name,
        email: normalizedData.email,
        phoneNumber: normalizedData.phoneNumber,
        discountType: discountType,
        commissionType: commissionType,
        isActive: true,
        totalSales: 0,
        totalCommission: 0,
        totalRevenue: 0,
        stripeCouponId,
        stripePromotionCodeId,
      };

      // Only set discount values based on type
      if (discountType === 'percentage') {
        cleanedData.discountPercentage = normalizedData.discountPercentage;
      } else {
        cleanedData.discountFixedAmount = normalizedData.discountFixedAmount;
      }

      // Only set commission values based on type
      if (commissionType === 'percentage') {
        cleanedData.commissionRate = normalizedData.commissionRate;
      } else {
        cleanedData.commissionFixedAmount = normalizedData.commissionFixedAmount;
      }

      const affiliate = new this.affiliateModel(cleanedData);
      
      return await affiliate.save();
    } catch (error) {
      console.error('Error creating affiliate:', error);
      throw error;
    }
  }

  async getAffiliateById(id: string) {
    const affiliate = await this.affiliateModel.findById(id);
    if (!affiliate) {
      throw new NotFoundException('Affiliate not found');
    }
    return affiliate;
  }

  async getAffiliateByCode(code: string) {
    const affiliate = await this.affiliateModel.findOne({
      affiliateCode: code.toUpperCase().trim()
    });
    if (!affiliate) {
      throw new NotFoundException('Affiliate not found');
    }
    return affiliate;
  }

  async updateAffiliate(id: string, updateData: Partial<Affiliate>) {
    const affiliate = await this.affiliateModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    if (!affiliate) {
      throw new NotFoundException('Affiliate not found');
    }

    // If discount percentage changed and Stripe coupon exists, we need to handle this
    if (updateData.discountPercentage && affiliate.stripeCouponId) {
      console.log('Note: Stripe coupon discount cannot be updated. Consider creating a new affiliate code.');
    }

    return affiliate;
  }

  async getAffiliateStats(affiliateId: string) {
    const affiliate = await this.getAffiliateById(affiliateId);
    
    const commissions = await this.commissionModel.find({
      affiliateId: affiliateId
    });

    const stats = {
      totalSales: commissions.length,
      totalRevenue: commissions.reduce((sum, c) => sum + c.finalPrice, 0),
      totalCommission: commissions.reduce((sum, c) => sum + c.commissionAmount, 0),
      pendingCommission: commissions
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + c.commissionAmount, 0),
      paidCommission: commissions
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + c.commissionAmount, 0),
      recentSales: commissions
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10),
    };

    return {
      affiliate,
      stats,
    };
  }

  async createCommission(data: {
    affiliateId: string;
    affiliateCode: string;
    registrationId: string;
    customerEmail: string;
    customerName: string;
    originalPrice: number;
    discountAmount: number;
    finalPrice: number;
    commissionType?: 'percentage' | 'fixed';
    commissionRate?: number;
    commissionFixedAmount?: number;
    stripeSessionId?: string;
    paymentMethod?: string;
    metadata?: any;
  }) {
    // Calculate commission based on type
    let commissionAmount = 0;
    if (data.commissionType === 'fixed') {
      commissionAmount = data.commissionFixedAmount || 0;
    } else {
      commissionAmount = (data.finalPrice * (data.commissionRate || 0)) / 100;
    }

    const commission = new this.commissionModel({
      ...data,
      commissionAmount,
      status: 'pending',
    });

    const savedCommission = await commission.save();

    // Update affiliate stats
    await this.affiliateModel.findByIdAndUpdate(data.affiliateId, {
      $inc: {
        totalSales: 1,
        totalRevenue: data.finalPrice,
        totalCommission: commissionAmount,
      },
    });

    return savedCommission;
  }

  async updateCommissionStatus(
    commissionId: string,
    status: 'approved' | 'paid' | 'cancelled',
    paidAt?: Date
  ) {
    const updateData: any = { status };
    if (status === 'paid' && paidAt) {
      updateData.paidAt = paidAt;
    }

    return await this.commissionModel.findByIdAndUpdate(
      commissionId,
      updateData,
      { new: true }
    );
  }

  async getCommissionsByAffiliate(affiliateId: string, status?: string) {
    const query: any = { affiliateId };
    if (status) {
      query.status = status;
    }

    return await this.commissionModel
      .find(query)
      .sort({ createdAt: -1 });
  }

  async getAllCommissions(status?: string) {
    const query: any = {};
    if (status) {
      query.status = status;
    }

    return await this.commissionModel
      .find(query)
      .sort({ createdAt: -1 });
  }

  async getAllAffiliates(isActive?: boolean) {
    const query: any = {};
    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    return await this.affiliateModel
      .find(query)
      .sort({ createdAt: -1 });
  }

  async calculateDiscountedPrice(
    originalPrice: number, 
    discountType: 'percentage' | 'fixed' = 'percentage',
    discountValue: number
  ) {
    let discountAmount = 0;
    
    if (discountType === 'percentage') {
      discountAmount = (originalPrice * discountValue) / 100;
    } else {
      discountAmount = Math.min(discountValue, originalPrice); // Ensure discount doesn't exceed price
    }
    
    const finalPrice = originalPrice - discountAmount;
    
    return {
      originalPrice,
      discountType,
      discountValue,
      discountPercentage: discountType === 'percentage' ? discountValue : undefined,
      discountFixedAmount: discountType === 'fixed' ? discountValue : undefined,
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalPrice: Math.round(finalPrice * 100) / 100,
    };
  }

  async syncWithStripe(affiliateId: string) {
    const affiliate = await this.getAffiliateById(affiliateId);
    
    if (affiliate.stripeCouponId) {
      // Check if coupon still exists in Stripe
      try {
        const coupon = await this.stripe.coupons.retrieve(affiliate.stripeCouponId);
        return {
          status: 'synced',
          stripeCoupon: coupon,
        };
      } catch (error) {
        return {
          status: 'not_found',
          message: 'Stripe coupon not found',
        };
      }
    }

    // Create new Stripe coupon if doesn't exist
    try {
      const coupon = await this.stripe.coupons.create({
        percent_off: affiliate.discountPercentage,
        duration: 'once',
        id: `AFFILIATE_${affiliate.affiliateCode}`,
        metadata: {
          affiliateCode: affiliate.affiliateCode,
          affiliateName: affiliate.name,
          type: 'affiliate_discount',
        },
      });

      const promotionCode = await this.stripe.promotionCodes.create({
        coupon: coupon.id,
        code: affiliate.affiliateCode,
        metadata: {
          affiliateCode: affiliate.affiliateCode,
          affiliateName: affiliate.name,
        },
      });

      // Update affiliate with Stripe IDs
      await this.affiliateModel.findByIdAndUpdate(affiliateId, {
        stripeCouponId: coupon.id,
        stripePromotionCodeId: promotionCode.id,
      });

      return {
        status: 'created',
        stripeCoupon: coupon,
        stripePromotionCode: promotionCode,
      };
    } catch (error) {
      console.error('Error creating Stripe coupon:', error);
      throw new BadRequestException('Failed to create Stripe coupon');
    }
  }
}