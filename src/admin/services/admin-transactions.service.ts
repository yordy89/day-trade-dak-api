import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction } from '../../payments/stripe/transaction.schema';
import { User } from '../../users/user.schema';
import { StripeService } from '../../payments/stripe/stripe.service';
const PDFDocument = require('pdfkit');
import { format } from 'date-fns';

@Injectable()
export class AdminTransactionsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(User.name) private userModel: Model<User>,
    private stripeService: StripeService,
  ) {}

  async getTransactionDetails(transactionId: string) {
    const transaction = await this.transactionModel
      .findById(transactionId)
      .populate('userId', 'firstName lastName email')
      .lean();

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Transform the transaction data
    const user = transaction.userId as any;
    let customerName = 'Unknown';
    let customerEmail = 'Unknown';
    let customerId = '';

    // First try to get data from populated user
    if (user && user.firstName && user.lastName) {
      customerName = `${user.firstName} ${user.lastName}`;
      customerEmail = user.email || 'Unknown';
      customerId = user._id?.toString() || '';
    } 
    // If no user data, check metadata for customer information
    else if (transaction.metadata) {
      const metadata = transaction.metadata as any;
      if (metadata.firstName && metadata.lastName) {
        customerName = `${metadata.firstName} ${metadata.lastName}`;
      }
      if (metadata.email) {
        customerEmail = metadata.email;
      }
      // For transactions without userId, use transaction ID as customer reference
      customerId = transaction.userId?.toString() || `guest-${transaction._id.toString().slice(-8)}`;
    }

    return {
      _id: transaction._id.toString(),
      transactionId: transaction.stripePaymentIntentId || transaction._id.toString(),
      customerName,
      customerEmail,
      customerId,
      amount: transaction.amount,
      currency: transaction.currency || 'usd',
      method: transaction.paymentMethod || 'card',
      status: transaction.status,
      plan: transaction.plan,
      type: transaction.type,
      description: transaction.description || '',
      metadata: transaction.metadata,
      refundAmount: transaction.refundAmount || 0,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      stripePaymentIntentId: transaction.stripePaymentIntentId,
      stripeCustomerId: transaction.stripeCustomerId,
    };
  }

  async generateInvoice(transactionId: string): Promise<{ buffer: Buffer; filename: string }> {
    const transaction = await this.getTransactionDetails(transactionId);

    // Create a new PDF document
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    // Collect chunks
    doc.on('data', (chunk) => chunks.push(chunk));

    // Header
    doc.fontSize(20).text('DayTradeDak', 50, 50);
    doc.fontSize(12).text('Invoice', 50, 80);
    
    // Invoice details
    const invoiceDate = format(new Date(), 'MMM dd, yyyy');
    const transactionDate = format(new Date(transaction.createdAt), 'MMM dd, yyyy');
    
    doc.fontSize(10);
    doc.text(`Invoice Date: ${invoiceDate}`, 350, 50, { align: 'right' });
    doc.text(`Invoice Number: ${transaction.transactionId.slice(-8).toUpperCase()}`, 350, 65, { align: 'right' });
    doc.text(`Transaction ID: ${transaction.transactionId}`, 350, 80, { align: 'right' });

    // Customer info
    doc.text('Bill To:', 50, 130);
    doc.text(transaction.customerName, 50, 145);
    doc.text(transaction.customerEmail, 50, 160);

    // Transaction details table
    const tableTop = 220;
    doc.text('Description', 50, tableTop);
    doc.text('Date', 250, tableTop);
    doc.text('Amount', 400, tableTop, { align: 'right' });

    // Line
    doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke();

    // Transaction item
    const itemY = tableTop + 30;
    doc.text(transaction.description || transaction.plan || 'Payment', 50, itemY);
    doc.text(transactionDate, 250, itemY);
    doc.text(`$${transaction.amount.toFixed(2)}`, 400, itemY, { align: 'right' });

    // If there's a refund, show it
    if (transaction.refundAmount > 0) {
      const refundY = itemY + 20;
      doc.text('Refund', 50, refundY);
      doc.text('-', 250, refundY);
      doc.text(`-$${transaction.refundAmount.toFixed(2)}`, 400, refundY, { align: 'right' });
    }

    // Total
    const totalY = itemY + (transaction.refundAmount > 0 ? 60 : 40);
    doc.moveTo(350, totalY - 10).lineTo(500, totalY - 10).stroke();
    doc.fontSize(12).text('Total:', 350, totalY);
    const netAmount = transaction.amount - (transaction.refundAmount || 0);
    doc.text(`$${netAmount.toFixed(2)}`, 400, totalY, { align: 'right' });

    // Payment details
    doc.fontSize(10);
    const paymentY = totalY + 50;
    doc.text('Payment Information:', 50, paymentY);
    doc.text(`Payment Method: ${transaction.method.charAt(0).toUpperCase() + transaction.method.slice(1)}`, 50, paymentY + 15);
    doc.text(`Status: ${transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}`, 50, paymentY + 30);
    
    if (transaction.stripePaymentIntentId) {
      doc.fontSize(8);
      doc.text(`Stripe Payment Intent: ${transaction.stripePaymentIntentId}`, 50, paymentY + 45);
    }

    // Footer
    doc.fontSize(8);
    doc.text('Thank you for your business!', 50, 700, { align: 'center', width: 500 });
    doc.text('For questions about this invoice, please contact support@daytraded.com', 50, 715, { align: 'center', width: 500 });

    // Finalize the PDF
    doc.end();

    // Wait for all chunks to be collected
    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          buffer,
          filename: `invoice-${transaction.transactionId.slice(-8)}-${format(new Date(), 'yyyyMMdd')}.pdf`,
        });
      });
      doc.on('error', reject);
    });
  }

  async processRefund(transactionId: string, amount: number, reason: string) {
    const transaction = await this.transactionModel.findById(transactionId);

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.status !== 'succeeded') {
      throw new BadRequestException('Can only refund succeeded transactions');
    }

    if (!transaction.stripePaymentIntentId) {
      throw new BadRequestException('No payment intent associated with this transaction');
    }

    const maxRefundAmount = transaction.amount - (transaction.refundAmount || 0);
    if (amount > maxRefundAmount) {
      throw new BadRequestException(`Maximum refund amount is $${maxRefundAmount.toFixed(2)}`);
    }

    try {
      // Process refund through Stripe
      const refund = await this.stripeService.createRefund({
        paymentIntentId: transaction.stripePaymentIntentId,
        amount: Math.round(amount * 100), // Convert to cents
        reason: reason as any,
        metadata: {
          transactionId: transaction._id.toString(),
          adminRefund: 'true',
        },
      });

      // Update transaction with refund information
      const updatedRefundAmount = (transaction.refundAmount || 0) + amount;
      const newStatus = updatedRefundAmount >= transaction.amount ? 'refunded' : 'partially_refunded';

      await this.transactionModel.findByIdAndUpdate(transactionId, {
        refundAmount: updatedRefundAmount,
        status: newStatus,
        refundId: refund.id,
        refundReason: reason,
        refundedAt: new Date(),
      });

      return {
        success: true,
        refundId: refund.id,
        refundedAmount: amount,
        totalRefunded: updatedRefundAmount,
        status: newStatus,
        message: 'Refund processed successfully',
      };
    } catch (error: any) {
      console.error('Refund error:', error);
      throw new BadRequestException(
        error.message || 'Failed to process refund. Please try again or contact support.',
      );
    }
  }
}