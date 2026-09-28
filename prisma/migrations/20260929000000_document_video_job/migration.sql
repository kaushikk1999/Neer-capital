-- AlterTable
-- Additive: tracks an in-flight HeyGen render per document. Nullable, no default.
ALTER TABLE `documents` ADD COLUMN `video_job_id` VARCHAR(191) NULL;
