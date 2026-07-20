-- AlterTable
ALTER TABLE `analysis_jobs` ADD COLUMN `idempotency_key` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `document_analyses` ADD COLUMN `attribution` JSON NULL,
    ADD COLUMN `identity` JSON NULL,
    ADD COLUMN `investment_summary` JSON NULL,
    ADD COLUMN `quality_coverage` JSON NULL,
    ADD COLUMN `quality_formula_version` VARCHAR(191) NULL,
    ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `schema_version` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `supersedes_analysis_id` VARCHAR(191) NULL,
    ADD COLUMN `valuation_detail` JSON NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
    MODIFY `status` ENUM('PROCESSING', 'PARTIAL', 'REVIEW_REQUIRED', 'APPROVED', 'SUPERSEDED', 'FAILED') NOT NULL DEFAULT 'PROCESSING';

-- AlterTable
ALTER TABLE `document_charts` ADD COLUMN `config_v2` JSON NULL,
    ADD COLUMN `schema_version` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `document_metrics` ADD COLUMN `classification_code` ENUM('A', 'R', 'P', 'G', 'E', 'C', 'S', 'AI', 'U') NULL,
    ADD COLUMN `confidence_level` ENUM('HIGH', 'MEDIUM', 'LOW', 'CONFLICTING', 'MISSING', 'UNVERIFIED') NULL,
    ADD COLUMN `currency` VARCHAR(191) NULL,
    ADD COLUMN `decimal_value` DECIMAL(20, 4) NULL,
    ADD COLUMN `provenance` ENUM('ANALYST_STATED', 'PLATFORM_CALCULATED', 'AI_INFERRED', 'SYSTEM_GENERATED') NULL,
    ADD COLUMN `raw_value` VARCHAR(191) NULL,
    ADD COLUMN `review_status` ENUM('NOT_REVIEWED', 'IN_REVIEW', 'APPROVED', 'NEEDS_REVIEW', 'ERROR', 'MISSING', 'REJECTED') NOT NULL DEFAULT 'NOT_REVIEWED',
    ADD COLUMN `scale` VARCHAR(191) NULL,
    ADD COLUMN `source_page` INTEGER NULL,
    ADD COLUMN `taxonomy_key` VARCHAR(191) NULL,
    ADD COLUMN `validation_status` ENUM('VERIFIED', 'NEEDS_REVIEW', 'CONFLICTING', 'UNVERIFIED') NULL;

-- AlterTable
ALTER TABLE `document_sections` ADD COLUMN `review_status` ENUM('NOT_REVIEWED', 'IN_REVIEW', 'APPROVED', 'NEEDS_REVIEW', 'ERROR', 'MISSING', 'REJECTED') NOT NULL DEFAULT 'NOT_REVIEWED',
    ADD COLUMN `source_page` INTEGER NULL;

-- AlterTable
ALTER TABLE `documents` ADD COLUMN `active_published_snapshot_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `analysis_evidence` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `page` INTEGER NULL,
    `source_type` ENUM('NARRATIVE_QUOTE', 'TABLE_CELL', 'CHART_LABEL', 'HEADER', 'CALCULATED') NOT NULL,
    `original_quote` TEXT NULL,
    `normalized_quote` TEXT NULL,
    `cell_ref` JSON NULL,
    `bounding_box` JSON NULL,
    `crop_key` VARCHAR(191) NULL,
    `extraction_method` ENUM('TEXT_LAYER', 'TABLE_RECONSTRUCTED', 'OCR', 'CHART_DERIVED') NOT NULL,
    `verification_status` ENUM('EXACT_MATCH', 'NORMALIZED_MATCH', 'APPROXIMATE_MATCH', 'UNVERIFIED', 'CONFLICTING') NOT NULL DEFAULT 'UNVERIFIED',
    `verification_method` ENUM('DETERMINISTIC_NUMERIC', 'STRING_MATCH', 'MODEL_SEMANTIC', 'NONE') NOT NULL DEFAULT 'NONE',
    `confidence_level` ENUM('HIGH', 'MEDIUM', 'LOW', 'CONFLICTING', 'MISSING', 'UNVERIFIED') NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `analysis_evidence_analysis_id_idx`(`analysis_id`),
    INDEX `analysis_evidence_analysis_id_page_idx`(`analysis_id`, `page`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entity_evidence_links` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `evidence_id` VARCHAR(191) NOT NULL,
    `role` ENUM('PRIMARY', 'SUPPORTING', 'CONTRADICTING') NOT NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `entity_evidence_links_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `entity_evidence_links_evidence_id_idx`(`evidence_id`),
    UNIQUE INDEX `entity_evidence_links_analysis_id_entity_type_entity_id_evid_key`(`analysis_id`, `entity_type`, `entity_id`, `evidence_id`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analysis_issues` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL,
    `severity` ENUM('BLOCKER', 'WARNING', 'INFO') NOT NULL,
    `status` ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `code` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NULL,
    `message` TEXT NOT NULL,
    `details` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,
    `resolved_by` VARCHAR(191) NULL,

    INDEX `analysis_issues_analysis_id_status_idx`(`analysis_id`, `status`),
    INDEX `analysis_issues_fingerprint_idx`(`fingerprint`),
    UNIQUE INDEX `analysis_issues_analysis_id_revision_fingerprint_key`(`analysis_id`, `revision`, `fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `issue_acknowledgements` (
    `id` VARCHAR(191) NOT NULL,
    `issue_id` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `reviewer_id` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `revision` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `issue_acknowledgements_issue_id_idx`(`issue_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `idempotency_records` (
    `id` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `request_hash` VARCHAR(191) NOT NULL,
    `status` ENUM('IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'IN_PROGRESS',
    `owner` VARCHAR(191) NULL,
    `lease_expires_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `attempt_count` INTEGER NOT NULL DEFAULT 0,
    `response` JSON NULL,
    `status_code` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idempotency_records_status_lease_expires_at_idx`(`status`, `lease_expires_at`),
    INDEX `idempotency_records_expires_at_idx`(`expires_at`),
    UNIQUE INDEX `idempotency_records_scope_key_key`(`scope`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `runtime_flags` (
    `key` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `updated_by_id` VARCHAR(191) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thesis_drivers` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `title` VARCHAR(191) NOT NULL,
    `explanation` TEXT NOT NULL,
    `metric_key` VARCHAR(191) NULL,
    `direction` VARCHAR(191) NULL,
    `forecast_period` VARCHAR(191) NULL,
    `quantified_impact` VARCHAR(191) NULL,
    `provenance` ENUM('ANALYST_STATED', 'PLATFORM_CALCULATED', 'AI_INFERRED', 'SYSTEM_GENERATED') NOT NULL,
    `confidence_level` ENUM('HIGH', 'MEDIUM', 'LOW', 'CONFLICTING', 'MISSING', 'UNVERIFIED') NULL,
    `review_status` ENUM('NOT_REVIEWED', 'IN_REVIEW', 'APPROVED', 'NEEDS_REVIEW', 'ERROR', 'MISSING', 'REJECTED') NOT NULL DEFAULT 'NOT_REVIEWED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `thesis_drivers_analysis_id_order_idx`(`analysis_id`, `order`),
    INDEX `thesis_drivers_analysis_id_review_status_idx`(`analysis_id`, `review_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `counter_thesis_claims` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `claim` TEXT NOT NULL,
    `vulnerable_assumption` TEXT NULL,
    `provenance` ENUM('ANALYST_STATED', 'PLATFORM_CALCULATED', 'AI_INFERRED', 'SYSTEM_GENERATED') NOT NULL,
    `confidence_level` ENUM('HIGH', 'MEDIUM', 'LOW', 'CONFLICTING', 'MISSING', 'UNVERIFIED') NULL,
    `review_status` ENUM('NOT_REVIEWED', 'IN_REVIEW', 'APPROVED', 'NEEDS_REVIEW', 'ERROR', 'MISSING', 'REJECTED') NOT NULL DEFAULT 'NOT_REVIEWED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `counter_thesis_claims_analysis_id_order_idx`(`analysis_id`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thesis_break_conditions` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `condition` TEXT NOT NULL,
    `threshold` VARCHAR(191) NULL,
    `period` VARCHAR(191) NULL,
    `affected_driver_id` VARCHAR(191) NULL,
    `affected_metric_key` VARCHAR(191) NULL,
    `consequence` TEXT NULL,
    `provenance` ENUM('ANALYST_STATED', 'PLATFORM_CALCULATED', 'AI_INFERRED', 'SYSTEM_GENERATED') NOT NULL,
    `confidence_level` ENUM('HIGH', 'MEDIUM', 'LOW', 'CONFLICTING', 'MISSING', 'UNVERIFIED') NULL,
    `review_status` ENUM('NOT_REVIEWED', 'IN_REVIEW', 'APPROVED', 'NEEDS_REVIEW', 'ERROR', 'MISSING', 'REJECTED') NOT NULL DEFAULT 'NOT_REVIEWED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `thesis_break_conditions_analysis_id_order_idx`(`analysis_id`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `catalysts` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `name` VARCHAR(191) NOT NULL,
    `expected_period` VARCHAR(191) NULL,
    `direction` VARCHAR(191) NULL,
    `probability` VARCHAR(191) NULL,
    `importance` VARCHAR(191) NULL,
    `affected_metric_keys` JSON NULL,
    `explanation` TEXT NULL,
    `provenance` ENUM('ANALYST_STATED', 'PLATFORM_CALCULATED', 'AI_INFERRED', 'SYSTEM_GENERATED') NOT NULL,
    `confidence_level` ENUM('HIGH', 'MEDIUM', 'LOW', 'CONFLICTING', 'MISSING', 'UNVERIFIED') NULL,
    `review_status` ENUM('NOT_REVIEWED', 'IN_REVIEW', 'APPROVED', 'NEEDS_REVIEW', 'ERROR', 'MISSING', 'REJECTED') NOT NULL DEFAULT 'NOT_REVIEWED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `catalysts_analysis_id_order_idx`(`analysis_id`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `risk_items` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `explanation` TEXT NOT NULL,
    `probability` VARCHAR(191) NULL,
    `severity` VARCHAR(191) NULL,
    `horizon` VARCHAR(191) NULL,
    `controllability` VARCHAR(191) NULL,
    `affected_metric_keys` JSON NULL,
    `valuation_impact` VARCHAR(191) NULL,
    `trigger_threshold` VARCHAR(191) NULL,
    `mitigation` TEXT NULL,
    `causal_chain` JSON NULL,
    `provenance` ENUM('ANALYST_STATED', 'PLATFORM_CALCULATED', 'AI_INFERRED', 'SYSTEM_GENERATED') NOT NULL,
    `confidence_level` ENUM('HIGH', 'MEDIUM', 'LOW', 'CONFLICTING', 'MISSING', 'UNVERIFIED') NULL,
    `review_status` ENUM('NOT_REVIEWED', 'IN_REVIEW', 'APPROVED', 'NEEDS_REVIEW', 'ERROR', 'MISSING', 'REJECTED') NOT NULL DEFAULT 'NOT_REVIEWED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `risk_items_analysis_id_order_idx`(`analysis_id`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scenarios` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `kind` ENUM('BULL', 'BASE', 'BEAR') NOT NULL,
    `source` ENUM('ANALYST_STATED', 'PLATFORM_CALCULATED', 'AI_INFERRED', 'SYSTEM_GENERATED') NOT NULL,
    `assumptions` JSON NOT NULL,
    `target_price` VARCHAR(191) NULL,
    `upside_downside` VARCHAR(191) NULL,
    `review_status` ENUM('NOT_REVIEWED', 'IN_REVIEW', 'APPROVED', 'NEEDS_REVIEW', 'ERROR', 'MISSING', 'REJECTED') NOT NULL DEFAULT 'NOT_REVIEWED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `scenarios_analysis_id_idx`(`analysis_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `synthesized_claims` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `claim_type` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `supporting_metric_ids` JSON NOT NULL,
    `derivation` JSON NOT NULL,
    `numeric_verification` JSON NULL,
    `semantic_verification` JSON NULL,
    `verification_method` ENUM('DETERMINISTIC_NUMERIC', 'STRING_MATCH', 'MODEL_SEMANTIC', 'NONE') NOT NULL DEFAULT 'NONE',
    `confidence_level` ENUM('HIGH', 'MEDIUM', 'LOW', 'CONFLICTING', 'MISSING', 'UNVERIFIED') NULL,
    `review_status` ENUM('NOT_REVIEWED', 'IN_REVIEW', 'APPROVED', 'NEEDS_REVIEW', 'ERROR', 'MISSING', 'REJECTED') NOT NULL DEFAULT 'NOT_REVIEWED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `synthesized_claims_analysis_id_claim_type_idx`(`analysis_id`, `claim_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analysis_audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `field_path` VARCHAR(191) NOT NULL,
    `old_value` JSON NULL,
    `new_value` JSON NULL,
    `action` ENUM('EXTRACT', 'REEXTRACT', 'EDIT', 'APPROVE', 'REJECT', 'MARK_MISSING', 'NOTE', 'ACK_WARNING', 'PUBLISH', 'UNPUBLISH', 'FLAG_CHANGE') NOT NULL,
    `reviewer_id` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `analysis_revision` INTEGER NOT NULL,
    `request_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `analysis_audit_logs_analysis_id_idx`(`analysis_id`),
    INDEX `analysis_audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `analysis_audit_logs_reviewer_id_idx`(`reviewer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `publication_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `document_id` VARCHAR(191) NOT NULL,
    `publication_version` INTEGER NOT NULL,
    `analysis_id` VARCHAR(191) NULL,
    `analysis_revision` INTEGER NOT NULL,
    `source_analysis_revision_key` VARCHAR(191) NOT NULL,
    `rendered_payload` JSON NOT NULL,
    `attribution` JSON NOT NULL,
    `limitation_notice` JSON NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `superseded_at` DATETIME(3) NULL,
    `approved_by_id` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `publication_snapshots_source_analysis_revision_key_key`(`source_analysis_revision_key`),
    UNIQUE INDEX `publication_snapshots_request_id_key`(`request_id`),
    INDEX `publication_snapshots_document_id_idx`(`document_id`),
    INDEX `publication_snapshots_analysis_id_idx`(`analysis_id`),
    UNIQUE INDEX `publication_snapshots_document_id_publication_version_key`(`document_id`, `publication_version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `extraction_runs` (
    `id` VARCHAR(191) NOT NULL,
    `document_id` VARCHAR(191) NOT NULL,
    `analysis_id` VARCHAR(191) NULL,
    `run_id` VARCHAR(191) NOT NULL,
    `status` ENUM('QUEUED', 'PARSING', 'EXTRACTING', 'NORMALIZING', 'SYNTHESIZING', 'PERSISTING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED', 'TIMED_OUT') NOT NULL DEFAULT 'QUEUED',
    `stage` VARCHAR(191) NULL,
    `heartbeat_at` DATETIME(3) NULL,
    `model` VARCHAR(191) NULL,
    `prompt_version` VARCHAR(191) NULL,
    `schema_version` INTEGER NOT NULL DEFAULT 2,
    `input_doc_hash` VARCHAR(191) NOT NULL,
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `sanitized_error` TEXT NULL,
    `usage` JSON NULL,
    `validation_result` JSON NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_at` DATETIME(3) NULL,

    UNIQUE INDEX `extraction_runs_run_id_key`(`run_id`),
    INDEX `extraction_runs_document_id_status_idx`(`document_id`, `status`),
    INDEX `extraction_runs_analysis_id_idx`(`analysis_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `extraction_chunks` (
    `id` VARCHAR(191) NOT NULL,
    `run_id` VARCHAR(191) NOT NULL,
    `index` INTEGER NOT NULL,
    `page_start` INTEGER NOT NULL,
    `page_end` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'CLAIMED', 'EXTRACTING', 'VALIDATING', 'RETRY_WAIT', 'DONE', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `input_hash` VARCHAR(191) NOT NULL,
    `extracted_payload` JSON NULL,
    `validation_result` JSON NULL,
    `attempt_count` INTEGER NOT NULL DEFAULT 0,
    `lease_owner` VARCHAR(191) NULL,
    `lease_expires_at` DATETIME(3) NULL,
    `model` VARCHAR(191) NULL,
    `prompt_version` VARCHAR(191) NULL,
    `tokens_in` INTEGER NULL,
    `tokens_out` INTEGER NULL,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `error` TEXT NULL,

    INDEX `extraction_chunks_run_id_status_idx`(`run_id`, `status`),
    INDEX `extraction_chunks_lease_expires_at_idx`(`lease_expires_at`),
    UNIQUE INDEX `extraction_chunks_run_id_index_key`(`run_id`, `index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `worker_instances` (
    `id` VARCHAR(191) NOT NULL,
    `instance_id` VARCHAR(191) NOT NULL,
    `deployment_id` VARCHAR(191) NULL,
    `worker_version` VARCHAR(191) NOT NULL,
    `last_heartbeat_at` DATETIME(3) NOT NULL,
    `queue_connected` BOOLEAN NOT NULL DEFAULT false,
    `last_completed_job_id` VARCHAR(191) NULL,
    `stalled` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `worker_instances_instance_id_key`(`instance_id`),
    INDEX `worker_instances_last_heartbeat_at_idx`(`last_heartbeat_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `analysis_jobs_document_id_idempotency_key_key` ON `analysis_jobs`(`document_id`, `idempotency_key`);

-- CreateIndex
CREATE INDEX `document_analyses_document_id_status_idx` ON `document_analyses`(`document_id`, `status`);

-- CreateIndex
CREATE INDEX `document_analyses_supersedes_analysis_id_idx` ON `document_analyses`(`supersedes_analysis_id`);

-- Backfill: existing analyses all default to version 1, so a document that was
-- reprocessed has several rows sharing (document_id, 1). Number them by age
-- before adding the unique index, or this migration fails on any database that
-- already contains reprocessed documents (error 1062).
SET @rn := 0;
SET @prev := NULL;
UPDATE `document_analyses` da
JOIN (
  SELECT `id`,
         @rn := IF(@prev = `document_id`, @rn + 1, 1) AS new_version,
         @prev := `document_id` AS grp
  FROM `document_analyses`
  ORDER BY `document_id`, `created_at`, `id`
) ranked ON ranked.`id` = da.`id`
SET da.`version` = ranked.new_version;

-- CreateIndex
CREATE UNIQUE INDEX `document_analyses_document_id_version_key` ON `document_analyses`(`document_id`, `version`);

-- CreateIndex
CREATE INDEX `document_charts_analysis_id_order_idx` ON `document_charts`(`analysis_id`, `order`);

-- CreateIndex
CREATE INDEX `document_metrics_analysis_id_order_idx` ON `document_metrics`(`analysis_id`, `order`);

-- CreateIndex
CREATE INDEX `document_metrics_analysis_id_review_status_idx` ON `document_metrics`(`analysis_id`, `review_status`);

-- CreateIndex
CREATE INDEX `document_sections_analysis_id_order_idx` ON `document_sections`(`analysis_id`, `order`);

-- CreateIndex
CREATE UNIQUE INDEX `documents_active_published_snapshot_id_key` ON `documents`(`active_published_snapshot_id`);

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_active_published_snapshot_id_fkey` FOREIGN KEY (`active_published_snapshot_id`) REFERENCES `publication_snapshots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_analyses` ADD CONSTRAINT `document_analyses_supersedes_analysis_id_fkey` FOREIGN KEY (`supersedes_analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `analysis_evidence` ADD CONSTRAINT `analysis_evidence_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entity_evidence_links` ADD CONSTRAINT `entity_evidence_links_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entity_evidence_links` ADD CONSTRAINT `entity_evidence_links_evidence_id_fkey` FOREIGN KEY (`evidence_id`) REFERENCES `analysis_evidence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `analysis_issues` ADD CONSTRAINT `analysis_issues_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issue_acknowledgements` ADD CONSTRAINT `issue_acknowledgements_issue_id_fkey` FOREIGN KEY (`issue_id`) REFERENCES `analysis_issues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thesis_drivers` ADD CONSTRAINT `thesis_drivers_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `counter_thesis_claims` ADD CONSTRAINT `counter_thesis_claims_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thesis_break_conditions` ADD CONSTRAINT `thesis_break_conditions_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `catalysts` ADD CONSTRAINT `catalysts_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_items` ADD CONSTRAINT `risk_items_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scenarios` ADD CONSTRAINT `scenarios_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `synthesized_claims` ADD CONSTRAINT `synthesized_claims_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `analysis_audit_logs` ADD CONSTRAINT `analysis_audit_logs_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `publication_snapshots` ADD CONSTRAINT `publication_snapshots_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `publication_snapshots` ADD CONSTRAINT `publication_snapshots_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `extraction_runs` ADD CONSTRAINT `extraction_runs_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `extraction_runs` ADD CONSTRAINT `extraction_runs_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `document_analyses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `extraction_chunks` ADD CONSTRAINT `extraction_chunks_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `extraction_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

