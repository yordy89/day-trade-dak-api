import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuid } from 'uuid';

@Schema()
export class Mission extends Document {
  @Prop({ default: () => uuid(), unique: true })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true, type: Object })
  goals: {
    tradesPerDay: number;
    maxLoss: number;
    minWin: number;
  };

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ type: [String] })
  participants: string[];
}

export const MissionSchema = SchemaFactory.createForClass(Mission);
