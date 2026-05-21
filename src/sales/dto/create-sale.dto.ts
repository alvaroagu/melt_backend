import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCreditPaymentDto {
  @IsInt()
  paymentMethodId: number;

  @IsNumber()
  @Min(0)
  amountPaid: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceNumber?: string;
}

export class CreateSaleItemDto {
  @IsInt()
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  priceAtSale: number;

  @IsNumber()
  @Min(0)
  subtotal: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  flavorIds?: number[];
}

export class CreateSaleDto {
  @IsOptional()
  @IsInt()
  customerId?: number;

  @IsInt()
  paymentMethodId: number;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsOptional()
  @IsBoolean()
  isCredit?: boolean;

  @IsOptional()
  @IsDateString()
  saleDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items?: CreateSaleItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCreditPaymentDto)
  creditPayment?: CreateCreditPaymentDto;
}
