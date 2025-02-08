import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { TradeType } from 'src/constants';
import { v4 as uuid } from 'uuid';

@Schema()
export class Trade extends Document {
  @Prop({ default: () => uuid(), unique: true })
  id: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, enum: TradeType })
  tradeType: TradeType;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  entryPrice: number;

  @Prop({ required: true })
  exitPrice: number;

  @Prop({ required: true })
  profitOrLoss: number;

  @Prop({ required: true })
  date: Date;

  @Prop()
  notes: string;
}

export const TradeSchema = SchemaFactory.createForClass(Trade);
