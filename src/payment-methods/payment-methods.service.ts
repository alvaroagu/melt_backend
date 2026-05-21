import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createPaymentMethodDto: CreatePaymentMethodDto) {
    return this.prisma.paymentMethod.create({ data: createPaymentMethodDto });
  }

  findAll() {
    return this.prisma.paymentMethod.findMany({ orderBy: { id: 'asc' } });
  }

  findOne(id: number) {
    return this.prisma.paymentMethod.findUnique({
      where: { id },
      include: { sales: true, creditPayments: true },
    });
  }

  update(id: number, updatePaymentMethodDto: UpdatePaymentMethodDto) {
    return this.prisma.paymentMethod.update({
      where: { id },
      data: updatePaymentMethodDto,
    });
  }

  remove(id: number) {
    return this.prisma.paymentMethod.delete({ where: { id } });
  }
}
