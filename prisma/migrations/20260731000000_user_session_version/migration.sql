-- AlterTable
-- Additive: existing rows default to session version 0. No data is dropped.
ALTER TABLE `users` ADD COLUMN `session_version` INTEGER NOT NULL DEFAULT 0;
