-- CreateTable
-- Additive: durable cross-deploy cache of AI-translated report prose. Rows are
-- keyed by (analysis_id, revision, locale, scope); no existing data is affected.
CREATE TABLE `report_translations` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL,
    `locale` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `report_translations_analysis_id_idx`(`analysis_id`),
    UNIQUE INDEX `report_translations_analysis_id_revision_locale_scope_key`(`analysis_id`, `revision`, `locale`, `scope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
