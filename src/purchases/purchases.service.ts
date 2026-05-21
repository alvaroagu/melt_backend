import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePurchaseDto,
  CreatePurchaseItemDto,
} from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    supplier: true,
    items: {
      include: {
        product: true,
      },
    },
  } satisfies Prisma.PurchaseInclude;

  create(createPurchaseDto: CreatePurchaseDto) {
    return this.prisma.$transaction(async (tx) => {
      const { items, purchaseDate, ...data } = createPurchaseDto;
      const purchase = await tx.purchase.create({
        data: {
          ...data,
          ...(purchaseDate ? { purchaseDate: new Date(purchaseDate) } : {}),
        },
      });

      if (items?.length) {
        await tx.purchaseItem.createMany({
          data: items.map((item) => this.mapItem(purchase.id, item)),
        });
      }

      return tx.purchase.findUnique({
        where: { id: purchase.id },
        include: this.include,
      });
    });
  }

  findAll() {
    return this.prisma.purchase.findMany({
      orderBy: { id: 'asc' },
      include: this.include,
    });
  }

  findOne(id: number) {
    return this.prisma.purchase.findUnique({
      where: { id },
      include: this.include,
    });
  }

  update(id: number, updatePurchaseDto: UpdatePurchaseDto) {
    return this.prisma.$transaction(async (tx) => {
      const { items, purchaseDate, ...data } = updatePurchaseDto;
      await tx.purchase.update({
        where: { id },
        data: {
          ...data,
          ...(purchaseDate ? { purchaseDate: new Date(purchaseDate) } : {}),
        },
      });

      if (items !== undefined) {
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
        if (items.length) {
          await tx.purchaseItem.createMany({
            data: items.map((item) => this.mapItem(id, item)),
          });
        }
      }

      return tx.purchase.findUnique({
        where: { id },
        include: this.include,
      });
    });
  }

  remove(id: number) {
    return this.prisma.purchase.delete({ where: { id } });
  }

  private mapItem(purchaseId: number, item: CreatePurchaseItemDto) {
    return {
      purchaseId,
      productId: item.productId,
      quantity: item.quantity,
      costPerUnit: item.costPerUnit,
      subtotal: item.subtotal,
    };
  }
}
