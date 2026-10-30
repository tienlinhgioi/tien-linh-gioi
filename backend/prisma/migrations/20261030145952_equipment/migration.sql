-- AlterTable
ALTER TABLE `Character` ADD COLUMN `guildRole` VARCHAR(191) NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE `Item` ADD COLUMN `atkBonus` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `hpBonus` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `slot` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Equipment` (
    `characterId` INTEGER NOT NULL,
    `slot` VARCHAR(191) NOT NULL,
    `itemId` INTEGER NOT NULL,

    PRIMARY KEY (`characterId`, `slot`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Equipment` ADD CONSTRAINT `Equipment_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Equipment` ADD CONSTRAINT `Equipment_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
