import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  date: string; // IMPORTANT: use string not Date type here

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  vipPrice?: number;

  @IsOptional()
  @IsString()
  bannerImage?: string;
}
