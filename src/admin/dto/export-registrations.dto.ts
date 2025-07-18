import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ExportRegistrationsDto {
  @IsEnum(['csv', 'excel', 'pdf'])
  format: string;

  @IsOptional()
  filters?: {
    paymentStatus?: string;
  };
}