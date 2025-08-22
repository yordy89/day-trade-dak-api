import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
  SetMetadata,
} from '@nestjs/common';
import { AffiliateService } from './affiliate.service';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RolesGuard } from '../guards/roles.guard';
import { PermissionGuard, RequirePermissions } from '../guards/permission.guard';
import { Role } from '../constants';

const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

@Controller('affiliates')
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  // Public endpoint for validating referral codes
  @Post('validate-code')
  async validateCode(
    @Body() body: { code: string; eventType?: string }
  ) {
    try {
      const result = await this.affiliateService.validateCode(
        body.code,
        body.eventType
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Error validating referral code',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Calculate discounted price (public endpoint)
  @Post('calculate-discount')
  async calculateDiscount(
    @Body() body: { 
      originalPrice: number; 
      discountType?: 'percentage' | 'fixed';
      discountPercentage?: number;
      discountFixedAmount?: number;
    }
  ) {
    const discountType = body.discountType || 'percentage';
    const discountValue = discountType === 'percentage' 
      ? (body.discountPercentage || 0)
      : (body.discountFixedAmount || 0);
      
    return this.affiliateService.calculateDiscountedPrice(
      body.originalPrice,
      discountType,
      discountValue
    );
  }

  // Admin endpoints
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('affiliates')
  @Post()
  async createAffiliate(
    @Body() body: {
      affiliateCode: string;
      name: string;
      email: string;
      phoneNumber?: string;
      discountPercentage?: number;
      commissionRate?: number;
    }
  ) {
    return this.affiliateService.createAffiliate(body);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('affiliates')
  @Get()
  async getAllAffiliates(@Query('isActive') isActive?: string) {
    const activeFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.affiliateService.getAllAffiliates(activeFilter);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('affiliates')
  @Get('commissions')
  async getAllCommissions(@Query('status') status?: string) {
    return this.affiliateService.getAllCommissions(status);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('affiliates')
  @Get(':id')
  async getAffiliateById(@Param('id') id: string) {
    return this.affiliateService.getAffiliateById(id);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('affiliates')
  @Get(':id/stats')
  async getAffiliateStats(@Param('id') id: string) {
    return this.affiliateService.getAffiliateStats(id);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('affiliates')
  @Get(':id/commissions')
  async getAffiliateCommissions(
    @Param('id') id: string,
    @Query('status') status?: string
  ) {
    return this.affiliateService.getCommissionsByAffiliate(id, status);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('affiliates')
  @Put(':id')
  async updateAffiliate(
    @Param('id') id: string,
    @Body() updateData: {
      name?: string;
      email?: string;
      phoneNumber?: string;
      discountPercentage?: number;
      commissionRate?: number;
      isActive?: boolean;
    }
  ) {
    return this.affiliateService.updateAffiliate(id, updateData);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('affiliates')
  @Put('commissions/:id/status')
  async updateCommissionStatus(
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'paid' | 'cancelled'; paidAt?: Date }
  ) {
    return this.affiliateService.updateCommissionStatus(
      id,
      body.status,
      body.paidAt
    );
  }

  // Sync affiliate with Stripe (create coupons/promotion codes)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('affiliates')
  @Post(':id/sync-stripe')
  async syncWithStripe(@Param('id') id: string) {
    return this.affiliateService.syncWithStripe(id);
  }

  // Public endpoint for affiliates to check their stats (with code authentication)
  @Post('check-stats')
  async checkAffiliateStats(
    @Body() body: { affiliateCode: string; email: string }
  ) {
    try {
      const affiliate = await this.affiliateService.getAffiliateByCode(
        body.affiliateCode
      );
      
      // Verify email matches
      if (affiliate.email.toLowerCase() !== body.email.toLowerCase()) {
        throw new HttpException(
          'Invalid credentials',
          HttpStatus.UNAUTHORIZED
        );
      }

      return this.affiliateService.getAffiliateStats(affiliate._id.toString());
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error retrieving affiliate stats',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}