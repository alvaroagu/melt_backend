import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFlavorDto } from './dto/create-flavor.dto';
import { UpdateFlavorDto } from './dto/update-flavor.dto';

@Injectable()
export class FlavorsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createFlavorDto: CreateFlavorDto) {
    return this.prisma.flavor.create({ data: createFlavorDto });
  }

  findAll() {
    return this.prisma.flavor.findMany({ orderBy: { id: 'asc' } });
  }

  findOne(id: number) {
    return this.prisma.flavor.findUnique({
      where: { id },
      include: { saleItemFlavors: true },
    });
  }

  update(id: number, updateFlavorDto: UpdateFlavorDto) {
    return this.prisma.flavor.update({ where: { id }, data: updateFlavorDto });
  }

  remove(id: number) {
    return this.prisma.flavor.delete({ where: { id } });
  }
}
