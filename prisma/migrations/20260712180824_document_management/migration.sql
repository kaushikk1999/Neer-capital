-- AlterTable
ALTER TABLE `audit_logs` ADD COLUMN `document_id` VARCHAR(191) NULL,
    ADD COLUMN `user_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `documents` ADD COLUMN `slug` VARCHAR(191) NOT NULL,
    ADD COLUMN `storage_key` VARCHAR(191) NOT NULL,
    MODIFY `status` ENUM('DRAFT', 'PROCESSING', 'PUBLISHED', 'ARCHIVED', 'FAILED') NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE `document_files` (
    `id` VARCHAR(191) NOT NULL,
    `document_id` VARCHAR(191) NOT NULL,
    `storage_key` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `checksum` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `document_files_storage_key_key`(`storage_key`),
    INDEX `document_files_document_id_idx`(`document_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_versions` (
    `id` VARCHAR(191) NOT NULL,
    `document_id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `file_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `document_versions_file_id_key`(`file_id`),
    INDEX `document_versions_document_id_idx`(`document_id`),
    UNIQUE INDEX `document_versions_document_id_version_key`(`document_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `audit_logs_document_id_idx` ON `audit_logs`(`document_id`);

-- CreateIndex
CREATE UNIQUE INDEX `documents_slug_key` ON `documents`(`slug`);

-- AddForeignKey
ALTER TABLE `document_files` ADD CONSTRAINT `document_files_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_versions` ADD CONSTRAINT `document_versions_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_versions` ADD CONSTRAINT `document_versions_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `document_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

