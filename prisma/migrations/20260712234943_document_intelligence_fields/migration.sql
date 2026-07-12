-- AlterTable
ALTER TABLE `analysis_jobs` ADD COLUMN `attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `progress` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `document_analyses` ADD COLUMN `confidence` DOUBLE NULL,
    ADD COLUMN `raw_data` JSON NULL,
    ADD COLUMN `recommendation` TEXT NULL,
    ADD COLUMN `risks` TEXT NULL,
    ADD COLUMN `valuation` TEXT NULL;

-- AlterTable
ALTER TABLE `document_metrics` ADD COLUMN `category` VARCHAR(191) NULL,
    ADD COLUMN `numeric_value` DOUBLE NULL,
    ADD COLUMN `period` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `document_sections` ADD COLUMN `source_excerpt` TEXT NULL;

-- CreateIndex
CREATE INDEX `analysis_jobs_status_idx` ON `analysis_jobs`(`status`);

