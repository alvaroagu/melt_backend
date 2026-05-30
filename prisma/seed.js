require('dotenv/config');

const { hash } = require('bcryptjs');
const { PrismaClient, UserRole } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set.');
}

const prisma = new PrismaClient({ accelerateUrl: connectionString });

async function resetDatabase() {
  await prisma.creditPayment.deleteMany();
  await prisma.accountsReceivable.deleteMany();
  await prisma.saleItemFlavor.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.product.deleteMany();
  await prisma.flavor.deleteMany();
  await prisma.category.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.user.deleteMany();
}

async function seedUsers() {
  const adminPasswordHash = await hash('MeltAdmin123!', 10);
  const userPasswordHash = await hash('MeltUser123!', 10);

  return prisma.user.createMany({
    data: [
      {
        email: 'alvaro@melt.local',
        name: 'Alvaro Aguirre',
        passwordHash: adminPasswordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
      {
        email: 'ventas@melt.local',
        name: 'Equipo de Ventas',
        passwordHash: userPasswordHash,
        role: UserRole.USER,
        isActive: true,
      },
      {
        email: 'inventario@melt.local',
        name: 'Equipo de Inventario',
        passwordHash: userPasswordHash,
        role: UserRole.USER,
        isActive: true,
      },
    ],
  });
}

async function seedCatalogs() {
  await prisma.category.createMany({
    data: [
      { name: 'Helados' },
      { name: 'Toppings' },
      { name: 'Bebidas' },
    ],
  });

  await prisma.flavor.createMany({
    data: [
      { name: 'Vainilla', isAvailable: true, currentStockLiters: 18.5 },
      { name: 'Chocolate', isAvailable: true, currentStockLiters: 14.25 },
      { name: 'Fresa', isAvailable: true, currentStockLiters: 10.75 },
      { name: 'Menta', isAvailable: false, currentStockLiters: 2.0 },
    ],
  });

  await prisma.paymentMethod.createMany({
    data: [
      { name: 'Efectivo' },
      { name: 'Tarjeta' },
      { name: 'Transferencia' },
      { name: 'Crédito interno' },
    ],
  });

  await prisma.customer.createMany({
    data: [
      {
        taxId: 'CUST-001',
        fullName: 'Juan Perez',
        phone: '555-1001',
        creditLimit: 0,
        currentDebt: 0,
      },
      {
        taxId: 'CUST-002',
        fullName: 'Maria Gomez',
        phone: '555-1002',
        creditLimit: 500,
        currentDebt: 0,
      },
      {
        taxId: 'CUST-003',
        fullName: 'Cafeteria Central',
        phone: '555-1003',
        creditLimit: 1500,
        currentDebt: 90,
      },
    ],
  });

  await prisma.supplier.createMany({
    data: [
      {
        taxId: 'SUP-001',
        companyName: 'Distribuidora Lactea del Norte',
        phone: '555-2001',
        email: 'ventas@lacteanorte.local',
      },
      {
        taxId: 'SUP-002',
        companyName: 'Sabores y Esencias MX',
        phone: '555-2002',
        email: 'contacto@saboresmx.local',
      },
    ],
  });

  const categories = await prisma.category.findMany();
  const categoryByName = Object.fromEntries(
    categories.map((category) => [category.name, category]),
  );

  await prisma.product.createMany({
    data: [
      {
        categoryId: categoryByName.Helados.id,
        name: 'Helado base cono',
        unitCost: 15,
        unitPrice: 32,
        currentStock: 120,
        trackInventory: true,
      },
      {
        categoryId: categoryByName.Helados.id,
        name: 'Helado doble',
        unitCost: 24,
        unitPrice: 55,
        currentStock: 80,
        trackInventory: true,
      },
      {
        categoryId: categoryByName.Toppings.id,
        name: 'Topping de nuez',
        unitCost: 5,
        unitPrice: 12,
        currentStock: 150,
        trackInventory: true,
      },
      {
        categoryId: categoryByName.Bebidas.id,
        name: 'Malteada clasica',
        unitCost: 20,
        unitPrice: 48,
        currentStock: 60,
        trackInventory: true,
      },
      {
        categoryId: categoryByName.Bebidas.id,
        name: 'Cafe frio',
        unitCost: 12,
        unitPrice: 30,
        currentStock: 90,
        trackInventory: true,
      },
    ],
  });
}

async function seedPurchases() {
  const suppliers = await prisma.supplier.findMany();
  const products = await prisma.product.findMany();

  const supplierByName = Object.fromEntries(
    suppliers.map((supplier) => [supplier.companyName, supplier]),
  );
  const productByName = Object.fromEntries(
    products.map((product) => [product.name, product]),
  );

  await prisma.purchase.create({
    data: {
      supplierId: supplierByName['Distribuidora Lactea del Norte'].id,
      invoiceNumber: 'FAC-2026-001',
      totalCost: 980,
      purchaseDate: new Date('2026-05-03T10:00:00.000Z'),
      items: {
        create: [
          {
            productId: productByName['Helado base cono'].id,
            quantity: 20,
            costPerUnit: 15,
            subtotal: 300,
          },
          {
            productId: productByName['Helado doble'].id,
            quantity: 15,
            costPerUnit: 24,
            subtotal: 360,
          },
          {
            productId: productByName['Malteada clasica'].id,
            quantity: 16,
            costPerUnit: 20,
            subtotal: 320,
          },
        ],
      },
    },
  });

  await prisma.purchase.create({
    data: {
      supplierId: supplierByName['Sabores y Esencias MX'].id,
      invoiceNumber: 'FAC-2026-002',
      totalCost: 510,
      purchaseDate: new Date('2026-05-06T13:30:00.000Z'),
      items: {
        create: [
          {
            productId: productByName['Topping de nuez'].id,
            quantity: 30,
            costPerUnit: 5,
            subtotal: 150,
          },
          {
            productId: productByName['Cafe frio'].id,
            quantity: 30,
            costPerUnit: 12,
            subtotal: 360,
          },
        ],
      },
    },
  });
}

async function seedSales() {
  const customers = await prisma.customer.findMany();
  const paymentMethods = await prisma.paymentMethod.findMany();
  const products = await prisma.product.findMany();
  const flavors = await prisma.flavor.findMany();

  const customerByName = Object.fromEntries(
    customers.map((customer) => [customer.fullName, customer]),
  );
  const paymentMethodByName = Object.fromEntries(
    paymentMethods.map((paymentMethod) => [paymentMethod.name, paymentMethod]),
  );
  const productByName = Object.fromEntries(
    products.map((product) => [product.name, product]),
  );
  const flavorByName = Object.fromEntries(
    flavors.map((flavor) => [flavor.name, flavor]),
  );

  await prisma.sale.create({
    data: {
      customerId: customerByName['Juan Perez'].id,
      paymentMethodId: paymentMethodByName.Efectivo.id,
      totalAmount: 99,
      isCredit: false,
      saleDate: new Date('2026-05-07T15:10:00.000Z'),
      items: {
        create: [
          {
            productId: productByName['Helado base cono'].id,
            quantity: 2,
            priceAtSale: 32,
            subtotal: 64,
            saleItemFlavors: {
              create: [
                { flavorId: flavorByName.Vainilla.id },
                { flavorId: flavorByName.Chocolate.id },
              ],
            },
          },
          {
            productId: productByName['Topping de nuez'].id,
            quantity: 1,
            priceAtSale: 12,
            subtotal: 12,
          },
          {
            productId: productByName['Cafe frio'].id,
            quantity: 1,
            priceAtSale: 23,
            subtotal: 23,
          },
        ],
      },
    },
  });

  const creditSale = await prisma.sale.create({
    data: {
      customerId: customerByName['Cafeteria Central'].id,
      paymentMethodId: paymentMethodByName['Crédito interno'].id,
      totalAmount: 120,
      isCredit: true,
      saleDate: new Date('2026-05-10T18:00:00.000Z'),
      items: {
        create: [
          {
            productId: productByName['Helado doble'].id,
            quantity: 1,
            priceAtSale: 55,
            subtotal: 55,
            saleItemFlavors: {
              create: [
                { flavorId: flavorByName.Fresa.id },
                { flavorId: flavorByName.Vainilla.id },
              ],
            },
          },
          {
            productId: productByName['Malteada clasica'].id,
            quantity: 1,
            priceAtSale: 48,
            subtotal: 48,
          },
          {
            productId: productByName['Topping de nuez'].id,
            quantity: 1,
            priceAtSale: 17,
            subtotal: 17,
          },
        ],
      },
    },
  });

  const receivable = await prisma.accountsReceivable.create({
    data: {
      saleId: creditSale.id,
      customerId: customerByName['Cafeteria Central'].id,
      originalAmount: 120,
      remainingBalance: 90,
      status: 'PARTIAL',
      dueDate: new Date('2026-06-10T00:00:00.000Z'),
    },
  });

  await prisma.creditPayment.create({
    data: {
      arId: receivable.id,
      paymentMethodId: paymentMethodByName.Transferencia.id,
      amountPaid: 30,
      paymentDate: new Date('2026-05-14T11:30:00.000Z'),
      referenceNumber: 'TRX-2026-3001',
    },
  });
}

async function main() {
  await resetDatabase();
  await seedUsers();
  await seedCatalogs();
  await seedPurchases();
  await seedSales();

  console.log('Seed completed with demo business data.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
