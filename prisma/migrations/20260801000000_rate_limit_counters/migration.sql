-- CreateTable
-- Additive: distributed rate-limit counters. Rows are self-expiring via
-- expires_at and swept opportunistically; no existing data is affected.
CREATE TABLE `rate_limit_counters` (
    `key` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,
    `expires_at` DATETIME(3) NOT NULL,

    INDEX `rate_limit_counters_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
