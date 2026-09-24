-- Constraints and indexes that the Prisma schema language cannot express.
-- Each one is traceable to a requirement in REQUIREMENTS.md.

-- ---------------------------------------------------------------------------
-- Rating bounds: 0..5 enforced at the database level (FR-RAT-01, AC-12)
-- ---------------------------------------------------------------------------
ALTER TABLE "skill_assessment"
  ADD CONSTRAINT "skill_assessment_rating_range"
  CHECK ("rating" BETWEEN 0 AND 5);

ALTER TABLE "employee_skill"
  ADD CONSTRAINT "employee_skill_current_rating_range"
  CHECK ("current_rating" BETWEEN 0 AND 5);

ALTER TABLE "employee_skill"
  ADD CONSTRAINT "employee_skill_target_rating_range"
  CHECK ("target_rating" IS NULL OR "target_rating" BETWEEN 0 AND 5);

ALTER TABLE "rating_level"
  ADD CONSTRAINT "rating_level_value_range"
  CHECK ("value" BETWEEN 0 AND 5);

-- ---------------------------------------------------------------------------
-- Temporal rules (FR-SKL-05, FR-HIS-03)
-- ---------------------------------------------------------------------------

-- A rating may be backdated but never future-dated.
ALTER TABLE "skill_assessment"
  ADD CONSTRAINT "skill_assessment_effective_date_not_future"
  CHECK ("effective_date" <= CURRENT_DATE);

-- A target date is only meaningful alongside a target rating.
ALTER TABLE "employee_skill"
  ADD CONSTRAINT "employee_skill_target_consistent"
  CHECK ("target_date" IS NULL OR "target_rating" IS NOT NULL);

-- A correction or a void must carry a reason of at least 10 characters. The UI
-- blocks the save and the API returns 400; this is the backstop.
ALTER TABLE "skill_assessment"
  ADD CONSTRAINT "skill_assessment_change_reason_required"
  CHECK (
    NOT (
      "source" = 'CORRECTION'::"AssessmentSource"
      OR "status" = 'VOIDED'::"AssessmentStatus"
    )
    OR char_length(btrim(COALESCE("change_reason", ''))) >= 10
  );

-- ---------------------------------------------------------------------------
-- Data-shape invariants the application relies on (ARCHITECTURE.md 5.1)
-- ---------------------------------------------------------------------------

-- Nobody manages themselves. Longer reporting cycles are caught by the import
-- service, which cannot be expressed as a row-level constraint.
ALTER TABLE "employee"
  ADD CONSTRAINT "employee_not_self_managed"
  CHECK ("manager_id" IS NULL OR "manager_id" <> "id");

-- Emails are stored lower-cased so the unique index is case-insensitive.
ALTER TABLE "employee"
  ADD CONSTRAINT "employee_email_lowercase"
  CHECK ("email" = lower("email"));

ALTER TABLE "app_user"
  ADD CONSTRAINT "app_user_email_lowercase"
  CHECK ("email" = lower("email"));

-- normalized_name must really be normalized, or case-insensitive uniqueness
-- silently stops working (FR-CAT-05).
ALTER TABLE "skill"
  ADD CONSTRAINT "skill_normalized_name_is_normalized"
  CHECK ("normalized_name" = lower(btrim("normalized_name")));

-- ---------------------------------------------------------------------------
-- Indexes Prisma cannot declare
-- ---------------------------------------------------------------------------

-- Postgres treats NULLs as distinct, so @@unique([categoryId, value]) does not
-- prevent two *global* rows sharing a value. This partial index does (FR-RAT-05).
CREATE UNIQUE INDEX "rating_level_global_value_key"
  ON "rating_level" ("value")
  WHERE "category_id" IS NULL;

-- The access path for every as-of trend query: only live rows (ARCHITECTURE.md 7.2).
CREATE INDEX "skill_assessment_live_idx"
  ON "skill_assessment" ("employee_skill_id", "effective_date" DESC, "created_at" DESC)
  WHERE "superseded_at" IS NULL AND "status" = 'ACTIVE';

-- Case-insensitive name search for the employee directory (FR-EMP-02).
CREATE INDEX "employee_full_name_lower_idx" ON "employee" (lower("full_name"));
CREATE INDEX "skill_name_lower_idx" ON "skill" (lower("name"));

-- ---------------------------------------------------------------------------
-- Audit table is append-only (FR-AUD-03)
-- ---------------------------------------------------------------------------
-- Enforced with triggers rather than REVOKE, because the application may connect
-- as the table owner and owner privileges cannot be revoked. For defence in
-- depth, production should additionally connect as a role holding only
-- INSERT/SELECT on this table.

CREATE OR REPLACE FUNCTION "audit_event_append_only"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_event is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "audit_event_no_update"
  BEFORE UPDATE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION "audit_event_append_only"();

CREATE TRIGGER "audit_event_no_delete"
  BEFORE DELETE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION "audit_event_append_only"();
