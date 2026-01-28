import { prisma } from "../src/infrastructure/db/prisma.ts";

async function main() {
    // Settings (single row)
    await prisma.settings.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            boostSalesThresholdD90: 10,
            retireSalesThresholdD180: 2,
            requestThemePriorityThreshold: 3,
            defaultCurrency: "USD",
        },
    });

    // Products
    const p1 = await prisma.product.create({
        data: {
            name: "Custom Birthday Stirrers",
            productSource: "ETSY",
            productType: "stirrers",
            seasonality: "NONE",
            etsyListingId: "etsy-123",
        },
    });

    const p2 = await prisma.product.create({
        data: {
            name: "Wooden Baby Shower Toppers",
            productSource: "SHOPIFY",
            productType: "toppers",
            seasonality: "NONE",
            shopifyProductId: "shopify-456",
        },
    });

    // Sales records
    await prisma.salesRecord.createMany({
        data: [
            {
                productId: p1.id,
                salesPeriod: "D90",
                unitsSold: 18,
                revenueAmount: 180,
                asOfDate: new Date(),
            },
            {
                productId: p2.id,
                salesPeriod: "D180",
                unitsSold: 1,
                revenueAmount: 20,
                asOfDate: new Date(),
            },
        ],
    });

    // Requests
    await prisma.request.createMany({
        data: [
            { theme: "unicorn", channel: "WHATSAPP", status: "NEW" },
            { theme: "unicorn", channel: "FORM", status: "NEW" },
            { theme: "unicorn", channel: "MANUAL", status: "NEW" },
        ],
    });

    console.log("✅ Seed data created");
}

main()
    .catch((e) => {
        console.error(e);
        //process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
