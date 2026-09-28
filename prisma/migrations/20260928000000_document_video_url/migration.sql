-- AlterTable
-- Additive: optional presenter-video link per document. Nullable, no default,
-- so existing rows and published reports are unaffected.
ALTER TABLE `documents` ADD COLUMN `video_url` TEXT NULL;
