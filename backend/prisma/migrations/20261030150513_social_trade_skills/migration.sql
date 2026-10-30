-- AlterTable
ALTER TABLE `Character` ADD COLUMN `skillPoints` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Item` ADD COLUMN `quality` VARCHAR(191) NOT NULL DEFAULT 'COMMON';

-- CreateTable
CREATE TABLE `Friend` (
    `characterId` INTEGER NOT NULL,
    `friendId` INTEGER NOT NULL,

    PRIMARY KEY (`characterId`, `friendId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Block` (
    `characterId` INTEGER NOT NULL,
    `blockedId` INTEGER NOT NULL,

    PRIMARY KEY (`characterId`, `blockedId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CharacterSkill` (
    `characterId` INTEGER NOT NULL,
    `skillCode` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`characterId`, `skillCode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
