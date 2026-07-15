-- AlterTable
ALTER TABLE `analysis_jobs` ADD COLUMN `heartbeat_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `document_analyses` ADD COLUMN `status` ENUM('PROCESSING', 'REVIEW_REQUIRED', 'APPROVED', 'SUPERSEDED', 'FAILED') NOT NULL DEFAULT 'PROCESSING';

-- AlterTable
ALTER TABLE `documents` ADD COLUMN `published_analysis_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `documents_published_analysis_id_key` ON `documents`(`published_analysis_id`);

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_published_analysis_id_fkey` FOREIGN KEY (`published_analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

