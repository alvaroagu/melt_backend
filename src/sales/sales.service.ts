import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCreditPaymentDto,
  CreateSaleDto,
  CreateSaleItemDto,
} from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    customer: true,
    paymentMethod: true,
    items: {
      include: {
        product: true,
        saleItemFlavors: {
          include: {
            flavor: true,
          },
        },
      },
    },
    accountsReceivable: {
      include: {
        payments: true,
      },
    },
  } satisfies Prisma.SaleInclude;

  create(createSaleDto: CreateSaleDto) {
    return this.prisma.$transaction(async (tx) => {
      const { items, saleDate, dueDate, creditPayment, ...data } =
        createSaleDto;
      const sale = await tx.sale.create({
        data: {
          ...data,
          ...(saleDate ? { saleDate: new Date(saleDate) } : {}),
        },
      });

      if (items?.length) {
        await this.createItems(tx, sale.id, items);
      }

      if (creditPayment && !data.isCredit) {
        throw new BadRequestException('creditPayment requires a credit sale');
      }

      await this.syncReceivableAndPayment(tx, sale.id, {
        customerId: data.customerId ?? null,
        totalAmount: data.totalAmount,
        isCredit: data.isCredit ?? false,
        dueDate: dueDate ?? null,
        creditPayment: creditPayment ?? null,
      });

      return tx.sale.findUnique({
        where: { id: sale.id },
        include: this.include,
      });
    });
  }

  findAll() {
    return this.prisma.sale.findMany({
      orderBy: { id: 'asc' },
      include: this.include,
    });
  }

  findOne(id: number) {
    return this.prisma.sale.findUnique({
      where: { id },
      include: this.include,
    });
  }

  update(id: number, updateSaleDto: UpdateSaleDto) {
    return this.prisma.$transaction(async (tx) => {
      const { items, saleDate, dueDate, creditPayment, ...data } =
        updateSaleDto;
      const currentSale = await tx.sale.findUnique({
        where: { id },
        select: {
          customerId: true,
          totalAmount: true,
          isCredit: true,
        },
      });

      await tx.sale.update({
        where: { id },
        data: {
          ...data,
          ...(saleDate ? { saleDate: new Date(saleDate) } : {}),
        },
      });

      if (items !== undefined) {
        await this.replaceItems(tx, id, items);
      }

      const effectiveIsCredit = data.isCredit ?? currentSale?.isCredit ?? false;
      const effectiveCustomerId =
        data.customerId ?? currentSale?.customerId ?? null;
      const effectiveTotalAmount =
        data.totalAmount ?? currentSale?.totalAmount ?? null;

      await this.syncReceivableAndPayment(tx, id, {
        customerId: effectiveCustomerId,
        totalAmount: effectiveTotalAmount,
        isCredit: effectiveIsCredit,
        dueDate: dueDate ?? null,
        creditPayment: creditPayment ?? null,
      });

      return tx.sale.findUnique({
        where: { id },
        include: this.include,
      });
    });
  }

  remove(id: number) {
    return this.prisma.sale.delete({ where: { id } });
  }

  private async createItems(
    tx: Prisma.TransactionClient,
    saleId: number,
    items: CreateSaleItemDto[],
  ) {
    for (const item of items) {
      const createdItem = await tx.saleItem.create({
        data: {
          saleId,
          productId: item.productId,
          quantity: item.quantity,
          priceAtSale: item.priceAtSale,
          subtotal: item.subtotal,
        },
      });

      if (item.flavorIds?.length) {
        await tx.saleItemFlavor.createMany({
          data: item.flavorIds.map((flavorId) => ({
            saleItemId: createdItem.id,
            flavorId,
          })),
        });
      }
    }
  }

  private async replaceItems(
    tx: Prisma.TransactionClient,
    saleId: number,
    items: CreateSaleItemDto[],
  ) {
    const existingItems = await tx.saleItem.findMany({
      where: { saleId },
      select: { id: true },
    });

    if (existingItems.length) {
      await tx.saleItemFlavor.deleteMany({
        where: { saleItemId: { in: existingItems.map((item) => item.id) } },
      });
      await tx.saleItem.deleteMany({ where: { saleId } });
    }

    if (items.length) {
      await this.createItems(tx, saleId, items);
    }
  }

  private async syncReceivableAndPayment(
    tx: Prisma.TransactionClient,
    saleId: number,
    input: {
      customerId: number | null;
      totalAmount: Prisma.Decimal | number | null;
      isCredit: boolean;
      dueDate: string | null;
      creditPayment: CreateCreditPaymentDto | null;
    },
  ) {
    const existingReceivable = await tx.accountsReceivable.findFirst({
      where: { saleId },
    });

    if (!input.isCredit) {
      if (input.creditPayment) {
        throw new BadRequestException('creditPayment requires a credit sale');
      }

      if (existingReceivable) {
        await tx.creditPayment.deleteMany({
          where: { arId: existingReceivable.id },
        });
        await tx.accountsReceivable.deleteMany({ where: { saleId } });
      }
      return;
    }

    if (!input.customerId || input.totalAmount === null) {
      throw new BadRequestException(
        'customerId and totalAmount are required for credit sales',
      );
    }

    const receivableData = {
      customerId: input.customerId,
      originalAmount: input.totalAmount,
      remainingBalance: input.totalAmount,
      status: 'PENDING',
      ...(input.dueDate ? { dueDate: new Date(input.dueDate) } : {}),
    };

    const receivable = existingReceivable
      ? await tx.accountsReceivable.update({
          where: { id: existingReceivable.id },
          data: receivableData,
        })
      : await tx.accountsReceivable.create({
          data: {
            saleId,
            ...receivableData,
          },
        });

    if (input.creditPayment) {
      await tx.creditPayment.create({
        data: {
          arId: receivable.id,
          paymentMethodId: input.creditPayment.paymentMethodId,
          amountPaid: input.creditPayment.amountPaid,
          ...(input.creditPayment.referenceNumber
            ? { referenceNumber: input.creditPayment.referenceNumber }
            : {}),
        },
      });
    }
  }
}
