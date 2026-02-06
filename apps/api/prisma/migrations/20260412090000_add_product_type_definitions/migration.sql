-- CreateEnum
CREATE TYPE "ProductTypeStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "ProductTypeDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "synonymsJson" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductTypeStatus" NOT NULL DEFAULT 'ACTIVE',
    "tagsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTypeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductTypeDefinition_key_key" ON "ProductTypeDefinition"("key");
CREATE INDEX "ProductTypeDefinition_status_idx" ON "ProductTypeDefinition"("status");

INSERT INTO "ProductTypeDefinition" ("id", "key", "label", "synonymsJson", "required", "status", "createdAt", "updatedAt")
VALUES
    (
        'pt_cake_toppers',
        'cake_toppers',
        'Custom Cake Toppers',
        '["cake topper","cake toppers","custom cake topper","custom cake toppers","personalized cake topper","birthday cake topper","wedding cake topper","acrylic cake topper","wood cake topper","glitter cake topper"]',
        true,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'pt_cupcake_toppers',
        'cupcake_toppers',
        'Custom Cupcake Toppers',
        '["cupcake topper","cupcake toppers","custom cupcake topper","personalized cupcake topper","cupcake picks","cupcake flags","cake pick toppers","mini cake topper"]',
        true,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'pt_favor_bags',
        'favor_bags',
        'Favor Bags',
        '["favor bag","favor bags","party favor bag","party favor bags","goodie bag","goodie bags","treat bag","treat bags","goody bag","goody bags","party gift bag"]',
        true,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'pt_birthday_invitations',
        'birthday_invitations',
        'Birthday Invitations',
        '["birthday invitation","birthday invitations","kids birthday invitation","birthday party invitation","custom birthday invitation","printable birthday invitation","birthday invite","birthday invites"]',
        true,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'pt_thank_you_cards',
        'thank_you_cards',
        'Thank You Cards',
        '["thank you card","thank you cards","thankyou card","thankyou cards","thank you note","thank you notes","appreciation card","appreciation cards"]',
        true,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'pt_custom_stickers',
        'custom_stickers',
        'Custom Stickers',
        '["custom sticker","custom stickers","personalized sticker","personalized stickers","vinyl sticker","vinyl stickers","label sticker","label stickers","party sticker","party stickers"]',
        true,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'pt_drink_stirrers',
        'drink_stirrers',
        'Drink Stirrers',
        '["drink stirrer","drink stirrers","custom drink stirrer","cocktail stirrer","cocktail stirrers","swizzle stick","swizzle sticks","coffee stirrer","bar stirrer","stir sticks"]',
        true,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'pt_birthday_banners',
        'birthday_banners',
        'Happy Birthday Banners',
        '["birthday banner","birthday banners","happy birthday banner","happy birthday banners","party banner","birthday bunting","birthday garland","custom birthday banner"]',
        true,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'pt_laminated_cards',
        'laminated_cards',
        'Laminated Cards',
        '["laminated card","laminated cards","laminated menu","laminated menus","lamination card","laminated sign","laminated signs","laminated place card","laminated table card"]',
        true,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT ("key") DO NOTHING;
