-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EmployeeSource" AS ENUM ('EXCEL', 'MANUAL');

-- CreateEnum
CREATE TYPE "SkillStatus" AS ENUM ('ACTIVE', 'PENDING', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "EmployeeSkillStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- CreateEnum
CREATE TYPE "AssessmentSource" AS ENUM ('MANUAL', 'CORRECTION', 'IMPORT');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('DRY_RUN', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportRowOutcome" AS ENUM ('CREATED', 'UPDATED', 'UNCHANGED', 'ERROR', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('EMPLOYEE_CREATED', 'EMPLOYEE_UPDATED', 'SKILL_ASSIGNED', 'SKILL_ARCHIVED', 'ASSESSMENT_CREATED', 'ASSESSMENT_CORRECTED', 'ASSESSMENT_VOIDED', 'CATALOG_SKILL_CREATED', 'CATALOG_SKILL_UPDATED', 'CATALOG_SKILL_DEPRECATED', 'CATALOG_SKILL_MERGED', 'CATEGORY_CHANGED', 'RATING_SCALE_CHANGED', 'ROLE_CHANGED', 'IMPORT_COMMITTED');

-- CreateTable
CREATE TABLE "employee" (
    "id" UUID NOT NULL,
    "employee_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT,
    "designation" TEXT,
    "location" TEXT,
    "manager_id" UUID,
    "date_of_joining" DATE,
    "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "EmployeeSource" NOT NULL DEFAULT 'EXCEL',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "entra_object_id" TEXT,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "org_wide_write" BOOLEAN NOT NULL DEFAULT false,
    "employee_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "skill_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "description" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SkillStatus" NOT NULL DEFAULT 'ACTIVE',
    "merged_into_skill_id" UUID,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_level" (
    "id" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "category_id" UUID,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rating_level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_skill" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "current_rating" INTEGER NOT NULL,
    "current_assessment_id" UUID,
    "first_acquired_on" DATE NOT NULL,
    "last_assessed_on" DATE NOT NULL,
    "target_rating" INTEGER,
    "target_date" DATE,
    "status" "EmployeeSkillStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_assessment" (
    "id" UUID NOT NULL,
    "employee_skill_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "effective_date" DATE NOT NULL,
    "note" TEXT,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "AssessmentSource" NOT NULL DEFAULT 'MANUAL',
    "assessed_by_user_id" UUID,
    "supersedes_id" UUID,
    "superseded_at" TIMESTAMPTZ(3),
    "change_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" SERIAL NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "actor_role" "Role",
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "employee_id" UUID,
    "skill_id" UUID,
    "before_state" JSONB,
    "after_state" JSONB,
    "reason" TEXT,
    "request_id" TEXT,
    "ip_address" TEXT,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batch" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "stored_path" TEXT,
    "uploaded_by_user_id" UUID,
    "status" "ImportStatus" NOT NULL DEFAULT 'DRY_RUN',
    "mark_missing_inactive" BOOLEAN NOT NULL DEFAULT false,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "unchanged_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "error_summary" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at" TIMESTAMPTZ(3),

    CONSTRAINT "import_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_row" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_values" JSONB NOT NULL,
    "outcome" "ImportRowOutcome" NOT NULL,
    "error_message" TEXT,
    "changes" JSONB,
    "employee_id" UUID,

    CONSTRAINT "import_row_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_employee_code_key" ON "employee"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employee_email_key" ON "employee"("email");

-- CreateIndex
CREATE INDEX "employee_manager_id_idx" ON "employee"("manager_id");

-- CreateIndex
CREATE INDEX "employee_department_idx" ON "employee"("department");

-- CreateIndex
CREATE INDEX "employee_employment_status_idx" ON "employee"("employment_status");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_entra_object_id_key" ON "app_user"("entra_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_employee_id_key" ON "app_user"("employee_id");

-- CreateIndex
CREATE INDEX "app_user_role_idx" ON "app_user"("role");

-- CreateIndex
CREATE UNIQUE INDEX "skill_category_name_key" ON "skill_category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skill_normalized_name_key" ON "skill"("normalized_name");

-- CreateIndex
CREATE INDEX "skill_category_id_idx" ON "skill"("category_id");

-- CreateIndex
CREATE INDEX "skill_status_idx" ON "skill"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rating_level_category_id_value_key" ON "rating_level"("category_id", "value");

-- CreateIndex
CREATE UNIQUE INDEX "employee_skill_current_assessment_id_key" ON "employee_skill"("current_assessment_id");

-- CreateIndex
CREATE INDEX "employee_skill_skill_id_idx" ON "employee_skill"("skill_id");

-- CreateIndex
CREATE INDEX "employee_skill_status_idx" ON "employee_skill"("status");

-- CreateIndex
CREATE UNIQUE INDEX "employee_skill_employee_id_skill_id_key" ON "employee_skill"("employee_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_assessment_supersedes_id_key" ON "skill_assessment"("supersedes_id");

-- CreateIndex
CREATE INDEX "skill_assessment_employee_skill_id_effective_date_created_a_idx" ON "skill_assessment"("employee_skill_id", "effective_date" DESC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "skill_assessment_effective_date_idx" ON "skill_assessment"("effective_date");

-- CreateIndex
CREATE INDEX "audit_event_employee_id_occurred_at_idx" ON "audit_event"("employee_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_event_entity_type_entity_id_occurred_at_idx" ON "audit_event"("entity_type", "entity_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_event_actor_user_id_occurred_at_idx" ON "audit_event"("actor_user_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_event_action_occurred_at_idx" ON "audit_event"("action", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_event_skill_id_occurred_at_idx" ON "audit_event"("skill_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "import_batch_created_at_idx" ON "import_batch"("created_at" DESC);

-- CreateIndex
CREATE INDEX "import_row_batch_id_outcome_idx" ON "import_row"("batch_id", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "import_row_batch_id_row_number_key" ON "import_row"("batch_id", "row_number");

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill" ADD CONSTRAINT "skill_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "skill_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill" ADD CONSTRAINT "skill_merged_into_skill_id_fkey" FOREIGN KEY ("merged_into_skill_id") REFERENCES "skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill" ADD CONSTRAINT "skill_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_level" ADD CONSTRAINT "rating_level_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "skill_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skill" ADD CONSTRAINT "employee_skill_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skill" ADD CONSTRAINT "employee_skill_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skill" ADD CONSTRAINT "employee_skill_current_assessment_id_fkey" FOREIGN KEY ("current_assessment_id") REFERENCES "skill_assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_assessment" ADD CONSTRAINT "skill_assessment_employee_skill_id_fkey" FOREIGN KEY ("employee_skill_id") REFERENCES "employee_skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_assessment" ADD CONSTRAINT "skill_assessment_assessed_by_user_id_fkey" FOREIGN KEY ("assessed_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_assessment" ADD CONSTRAINT "skill_assessment_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "skill_assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
