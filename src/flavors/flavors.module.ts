import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FlavorsController } from './flavors.controller';
import { FlavorsService } from './flavors.service';

@Module({
  imports: [PrismaModule],
  controllers: [FlavorsController],
  providers: [FlavorsService],
})
export class FlavorsModule {}
