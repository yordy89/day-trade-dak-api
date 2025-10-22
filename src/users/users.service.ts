// src/user/user.service.ts

import { Injectable, NotFoundException, BadRequestException, Inject, StreamableFile } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { CreateUserInput } from './user.dto';
import { S3ServiceOptimized } from 'src/aws/s3/s3.service.optimized';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { FileValidationHelper } from '../helpers/file-validation.helper';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class UserService {
  private stripe: Stripe;

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @Inject('S3Service') private readonly s3Service: S3ServiceOptimized,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
      { apiVersion: '2025-01-27.acacia' },
    );
  }

  async findAll(): Promise<User[]> {
    // Exclude soft-deleted users from all queries
    return this.userModel.find({ isDeleted: { $ne: true } }).exec();
  }

  async findByEmail(email: string): Promise<User | null> {
    // Exclude soft-deleted users
    return this.userModel.findOne({ email, isDeleted: { $ne: true } }).exec();
  }

  async findOne(query: any): Promise<User | null> {
    // Exclude soft-deleted users
    return this.userModel.findOne({ ...query, isDeleted: { $ne: true } }).exec();
  }

  async createUser(data: CreateUserInput): Promise<User> {
    const user = new this.userModel(data);
    return user.save();
  }

  async findById(userId: string): Promise<User | null> {
    // Exclude soft-deleted users
    return this.userModel.findOne({ _id: userId, isDeleted: { $ne: true } }).exec();
  }

  async updateUser(
    userId: string,
    updateData: Record<string, any>,
  ): Promise<User | null> {
    return this.userModel
      .findOneAndUpdate({ _id: userId }, updateData, { new: true }) // ✅ Use `_id`
      .exec();
  }

  async findByRecoveryToken(recoveryToken: string): Promise<User | null> {
    return this.userModel.findOne({ recoveryToken }).exec();
  }

  async clearRecoveryToken(userId: string): Promise<any> {
    await this.userModel
      .findOneAndUpdate({ id: userId }, { recoveryToken: null })
      .exec();
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    // Validate file before uploading
    FileValidationHelper.validateProfileImage(file);

    // Sanitize filename
    file.originalname = FileValidationHelper.sanitizeFileName(file.originalname);

    const uploadResult = await this.s3Service.uploadProfileImage(file, userId);
    return this.userModel.findByIdAndUpdate(
      userId,
      { profileImage: uploadResult.url },
      { new: true },
    );
  }

  async findByStripeCustomerId(customerId: string): Promise<User | null> {
    return this.userModel.findOne({ stripeCustomerId: customerId }).exec();
  }

  async saveStripeCustomerId(
    userId: string,
    stripeCustomerId: string,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { stripeCustomerId }).exec();
  }

  async deleteUserFromAdmin(userId: string, adminId?: string, reason?: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.isDeleted) {
      throw new BadRequestException('User is already deleted');
    }

    // Soft delete: Mark as deleted instead of removing from database
    // This preserves payment records and audit trails for legal compliance
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = adminId;
    user.deletionReason = (reason as any) || 'admin_action';

    // Schedule permanent deletion after 30 days
    const scheduledDeletion = new Date();
    scheduledDeletion.setDate(scheduledDeletion.getDate() + 30);
    user.scheduledDeletionDate = scheduledDeletion;

    await user.save();

    return {
      message: `User ${user.email} has been soft deleted. Permanent deletion scheduled for ${scheduledDeletion.toISOString()}`,
      userId,
      scheduledDeletionDate: scheduledDeletion,
    };
  }

  async requestAccountDeletion(userId: string): Promise<{
    message: string;
    scheduledDeletionDate: Date;
    gracePeriodDays: number;
  }> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.isDeleted) {
      throw new BadRequestException('Account deletion already requested');
    }

    // Soft delete with user_request reason
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletionReason = 'user_request';

    // Schedule permanent deletion after 30 days
    const scheduledDeletion = new Date();
    scheduledDeletion.setDate(scheduledDeletion.getDate() + 30);
    user.scheduledDeletionDate = scheduledDeletion;

    await user.save();

    // TODO: Send confirmation email with cancellation link

    return {
      message: 'Account deletion requested. You have 30 days to cancel this request.',
      scheduledDeletionDate: scheduledDeletion,
      gracePeriodDays: 30,
    };
  }

  async cancelAccountDeletion(userId: string): Promise<{
    message: string;
  }> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.isDeleted) {
      throw new BadRequestException('No deletion request found for this account');
    }

    if (user.isAnonymized) {
      throw new BadRequestException('Account has already been anonymized and cannot be recovered');
    }

    // Restore account
    user.isDeleted = false;
    user.deletedAt = undefined;
    user.deletedBy = undefined;
    user.deletionReason = undefined;
    user.scheduledDeletionDate = undefined;

    await user.save();

    return {
      message: 'Account deletion cancelled. Your account has been restored.',
    };
  }

  async exportUserData(userId: string, format: 'json' | 'pdf' | 'excel' = 'json'): Promise<any> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Compile all user data for GDPR data portability
    // SECURITY: Remove all internal MongoDB _id fields
    const userData = {
      personalInformation: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || 'No proporcionado',
        address: user.address || 'No proporcionado',
        profileImage: user.profileImage || 'Sin imagen',
        accountCreatedAt: user.createdAt,
        lastLoginAt: user.lastLogin || 'Nunca',
      },
      subscriptions: user.subscriptions.map(sub => ({
        // Remove _id field for security
        plan: sub.plan,
        expiresAt: sub.expiresAt || 'Permanente',
        status: sub.status || 'active',
        createdAt: sub.createdAt,
        currentPeriodEnd: sub.currentPeriodEnd,
      })),
      emailPreferences: {
        marketing: user.emailPreferences?.marketing ?? true,
        newsletter: user.emailPreferences?.newsletter ?? true,
        events: user.emailPreferences?.events ?? true,
        educational: user.emailPreferences?.educational ?? true,
        promotional: user.emailPreferences?.promotional ?? true,
        transactional: user.emailPreferences?.transactional ?? true,
        // Remove _id field
      },
      tradingData: {
        tradingPhase: user.tradingPhase || 'No iniciado',
        allowLiveMeetingAccess: user.allowLiveMeetingAccess || false,
        allowLiveWeeklyAccess: user.allowLiveWeeklyAccess || false,
      },
      mediaUsageTerms: {
        accepted: user.acceptedMediaUsageTerms || false,
        acceptedAt: user.mediaUsageTermsAcceptedAt || 'No aceptado',
      },
      accountStatus: {
        status: user.status || 'active',
        role: user.role || 'user',
        memberSince: user.createdAt,
      },
      // Don't expose Stripe customer ID for security
      paymentInformation: {
        hasPaymentMethod: !!user.stripeCustomerId,
        totalSubscriptions: user.subscriptions.length,
      },
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        exportFormat: 'GDPR Compliant Data Export',
        dataController: 'DayTradeDak',
      },
    };

    // Return data in requested format
    if (format === 'json') {
      return userData;
    } else if (format === 'pdf') {
      return this.generatePDFExport(userData, user);
    } else if (format === 'excel') {
      return this.generateExcelExport(userData, user);
    }

    return userData;
  }

  private async generatePDFExport(userData: any, user: User): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).fillColor('#16a34a').text('DayTradeDak - Exportación de Datos Personales', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).fillColor('#666').text(`RGPD Artículo 20 - Derecho a la Portabilidad de Datos`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(9).fillColor('#999').text(`Generado el: ${new Date().toLocaleString('es-ES')}`, { align: 'center' });
      doc.moveDown(2);

      // Personal Information
      doc.fontSize(14).fillColor('#000').text('Información Personal', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#333');
      doc.text(`Nombre: ${userData.personalInformation.firstName} ${userData.personalInformation.lastName}`);
      doc.text(`Email: ${userData.personalInformation.email}`);
      doc.text(`Teléfono: ${userData.personalInformation.phone}`);
      doc.text(`Dirección: ${userData.personalInformation.address}`);
      doc.text(`Cuenta creada: ${userData.personalInformation.accountCreatedAt ? new Date(userData.personalInformation.accountCreatedAt).toLocaleDateString('es-ES') : 'No disponible'}`);
      doc.text(`Último acceso: ${userData.personalInformation.lastLoginAt !== 'Nunca' && userData.personalInformation.lastLoginAt ? new Date(userData.personalInformation.lastLoginAt).toLocaleDateString('es-ES') : 'Nunca'}`);
      doc.moveDown(1.5);

      // Subscriptions
      doc.fontSize(14).fillColor('#000').text('Suscripciones', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#333');
      if (userData.subscriptions.length > 0) {
        userData.subscriptions.forEach((sub: any, index: number) => {
          doc.text(`${index + 1}. ${sub.plan} - Estado: ${sub.status} - Expira: ${sub.expiresAt !== 'Permanente' ? new Date(sub.expiresAt).toLocaleDateString('es-ES') : 'Permanente'}`);
        });
      } else {
        doc.text('Sin suscripciones activas');
      }
      doc.moveDown(1.5);

      // Email Preferences
      doc.fontSize(14).fillColor('#000').text('Preferencias de Email', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#333');
      doc.text(`Marketing: ${userData.emailPreferences.marketing ? 'Activado' : 'Desactivado'}`);
      doc.text(`Newsletter: ${userData.emailPreferences.newsletter ? 'Activado' : 'Desactivado'}`);
      doc.text(`Eventos: ${userData.emailPreferences.events ? 'Activado' : 'Desactivado'}`);
      doc.text(`Educativo: ${userData.emailPreferences.educational ? 'Activado' : 'Desactivado'}`);
      doc.text(`Promocional: ${userData.emailPreferences.promotional ? 'Activado' : 'Desactivado'}`);
      doc.moveDown(1.5);

      // Account Status
      doc.fontSize(14).fillColor('#000').text('Estado de Cuenta', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#333');
      doc.text(`Estado: ${userData.accountStatus.status}`);
      doc.text(`Rol: ${userData.accountStatus.role}`);
      doc.text(`Miembro desde: ${userData.accountStatus.memberSince ? new Date(userData.accountStatus.memberSince).toLocaleDateString('es-ES') : 'No disponible'}`);
      doc.moveDown(2);

      // Footer
      doc.fontSize(8).fillColor('#999').text('Este documento contiene toda tu información personal almacenada en DayTradeDak.', { align: 'center' });
      doc.text('Para más información sobre privacidad, contacta: support@daytradedak.com', { align: 'center' });

      doc.end();
    });
  }

  private async generateExcelExport(userData: any, user: User): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DayTradeDak';
    workbook.created = new Date();

    // Personal Information Sheet
    const personalSheet = workbook.addWorksheet('Información Personal');
    personalSheet.columns = [
      { header: 'Campo', key: 'field', width: 30 },
      { header: 'Valor', key: 'value', width: 50 },
    ];

    personalSheet.addRows([
      { field: 'Nombre', value: userData.personalInformation.firstName },
      { field: 'Apellido', value: userData.personalInformation.lastName },
      { field: 'Email', value: userData.personalInformation.email },
      { field: 'Teléfono', value: userData.personalInformation.phone },
      { field: 'Dirección', value: userData.personalInformation.address },
      { field: 'Cuenta creada', value: userData.personalInformation.accountCreatedAt ? new Date(userData.personalInformation.accountCreatedAt).toLocaleDateString('es-ES') : 'No disponible' },
      { field: 'Último acceso', value: userData.personalInformation.lastLoginAt !== 'Nunca' && userData.personalInformation.lastLoginAt ? new Date(userData.personalInformation.lastLoginAt).toLocaleDateString('es-ES') : 'Nunca' },
    ]);

    // Style header row
    personalSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    personalSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16a34a' } };

    // Subscriptions Sheet
    const subscriptionsSheet = workbook.addWorksheet('Suscripciones');
    subscriptionsSheet.columns = [
      { header: 'Plan', key: 'plan', width: 30 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Expira', key: 'expiresAt', width: 25 },
      { header: 'Creada', key: 'createdAt', width: 25 },
    ];

    userData.subscriptions.forEach((sub: any) => {
      subscriptionsSheet.addRow({
        plan: sub.plan,
        status: sub.status,
        expiresAt: sub.expiresAt !== 'Permanente' ? new Date(sub.expiresAt).toLocaleDateString('es-ES') : 'Permanente',
        createdAt: sub.createdAt ? new Date(sub.createdAt).toLocaleDateString('es-ES') : 'N/A',
      });
    });

    subscriptionsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    subscriptionsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16a34a' } };

    // Email Preferences Sheet
    const preferencesSheet = workbook.addWorksheet('Preferencias de Email');
    preferencesSheet.columns = [
      { header: 'Categoría', key: 'category', width: 30 },
      { header: 'Estado', key: 'status', width: 20 },
    ];

    preferencesSheet.addRows([
      { category: 'Marketing', status: userData.emailPreferences.marketing ? 'Activado' : 'Desactivado' },
      { category: 'Newsletter', status: userData.emailPreferences.newsletter ? 'Activado' : 'Desactivado' },
      { category: 'Eventos', status: userData.emailPreferences.events ? 'Activado' : 'Desactivado' },
      { category: 'Educativo', status: userData.emailPreferences.educational ? 'Activado' : 'Desactivado' },
      { category: 'Promocional', status: userData.emailPreferences.promotional ? 'Activado' : 'Desactivado' },
      { category: 'Transaccional', status: userData.emailPreferences.transactional ? 'Activado' : 'Desactivado' },
    ]);

    preferencesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    preferencesSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16a34a' } };

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }

  async findUsersForPermanentDeletion(now: Date): Promise<User[]> {
    return this.userModel.find({
      isDeleted: true,
      isAnonymized: { $ne: true },
      scheduledDeletionDate: { $lte: now },
    }).exec();
  }

  async permanentlyDeleteUser(userId: string) {
    // This should only be called by cron job after grace period
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.isDeleted) {
      throw new BadRequestException('User must be soft deleted before permanent deletion');
    }

    // Anonymize instead of delete to preserve payment records for legal/tax requirements
    user.firstName = 'Deleted';
    user.lastName = 'User';
    user.email = `deleted_${userId}@anonymized.local`;
    user.password = ''; // Clear password hash
    user.profileImage = '';
    user.phone = '';
    user.address = '';
    user.isAnonymized = true;

    await user.save();

    return {
      message: `User ${userId} has been permanently anonymized`,
      userId,
    };
  }

  async getSubscriptionDetails(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Fetch live subscription data from Stripe for recurring subscriptions
    const detailedSubscriptions = await Promise.all(
      user.subscriptions.map(async (sub) => {
        const subscriptionData = { ...sub };

        // If it has a Stripe subscription ID, fetch live data
        if (
          sub.stripeSubscriptionId &&
          user.activeSubscriptions.includes(sub.stripeSubscriptionId)
        ) {
          try {
            const stripeSubscription = await this.stripe.subscriptions.retrieve(
              sub.stripeSubscriptionId,
            );

            // Update with live data from Stripe
            subscriptionData.currentPeriodEnd = new Date(
              stripeSubscription.current_period_end * 1000,
            );
            subscriptionData.status = stripeSubscription.status;

            // Add next payment attempt if available
            if (stripeSubscription.status === 'active') {
              subscriptionData['nextPaymentDate'] = new Date(
                stripeSubscription.current_period_end * 1000,
              );
            }
          } catch (error) {
            console.error(
              `Failed to fetch Stripe subscription ${sub.stripeSubscriptionId}:`,
              error,
            );
          }
        }

        return subscriptionData;
      }),
    );

    return {
      subscriptions: detailedSubscriptions,
    };
  }

  // Admin statistics methods
  async countUsers(): Promise<number> {
    return this.userModel.countDocuments().exec();
  }

  async countActiveUsers(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.userModel
      .countDocuments({
        lastLogin: { $gte: thirtyDaysAgo },
      })
      .exec();
  }

  async countSubscribedUsers(): Promise<number> {
    return this.userModel
      .countDocuments({
        'subscriptions.0': { $exists: true },
        'subscriptions.status': 'active',
      })
      .exec();
  }

  async countNewUsersToday(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.userModel
      .countDocuments({
        createdAt: { $gte: today },
      })
      .exec();
  }

  async countNewUsersThisWeek(): Promise<number> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return this.userModel
      .countDocuments({
        createdAt: { $gte: weekAgo },
      })
      .exec();
  }

  async countNewUsersThisMonth(): Promise<number> {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return this.userModel
      .countDocuments({
        createdAt: { $gte: monthAgo },
      })
      .exec();
  }

  async getSubscriptionsByPlan(): Promise<any> {
    const result = await this.userModel
      .aggregate([
        { $unwind: '$subscriptions' },
        { $match: { 'subscriptions.status': 'active' } },
        {
          $group: {
            _id: '$subscriptions.plan',
            count: { $sum: 1 },
            revenue: { $sum: '$subscriptions.price' },
          },
        },
        { $sort: { count: -1 } },
      ])
      .exec();

    return result.map((item) => ({
      plan: item._id,
      count: item.count,
      revenue: item.revenue,
    }));
  }

  async getExpiringSubscriptions(days: number): Promise<any[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.userModel
      .find({
        'subscriptions.status': 'active',
        'subscriptions.currentPeriodEnd': {
          $gte: new Date(),
          $lte: futureDate,
        },
      })
      .select('email subscriptions')
      .exec();
  }

  async getRecentCancellations(days: number): Promise<any[]> {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    return this.userModel
      .find({
        'subscriptions.status': 'canceled',
        'subscriptions.updatedAt': { $gte: daysAgo },
      })
      .select('email subscriptions')
      .exec();
  }
}
