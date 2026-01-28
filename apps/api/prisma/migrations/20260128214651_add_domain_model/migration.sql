-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('ETSY', 'SHOPIFY', 'BOTH');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Seasonality" AS ENUM ('NONE', 'VALENTINES', 'EASTER', 'BACK_TO_SCHOOL', 'HALLOWEEN', 'CHRISTMAS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SalesPeriod" AS ENUM ('D30', 'D90', 'D180', 'D365');

-- CreateEnum
CREATE TYPE "RequestChannel" AS ENUM ('WHATSAPP', 'FORM', 'MANUAL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('NEW', 'REVIEWED', 'FULFILLED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productSource" "ProductSource" NOT NULL,
    "productType" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "seasonality" "Seasonality" NOT NULL DEFAULT 'NONE',
    "shopifyProductId" TEXT,
    "etsyListingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRecord" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "salesPeriod" "SalesPeriod" NOT NULL,
    "unitsSold" INTEGER NOT NULL,
    "revenueAmount" DECIMAL(65,30) NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "channel" "RequestChannel" NOT NULL,
    "theme" TEXT NOT NULL,
    "productType" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'NEW',
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "boostSalesThresholdD90" INTEGER NOT NULL DEFAULT 10,
    "retireSalesThresholdD180" INTEGER NOT NULL DEFAULT 2,
    "requestThemePriorityThreshold" INTEGER NOT NULL DEFAULT 3,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
