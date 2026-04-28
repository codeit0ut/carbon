-- Inspection document tables
-- - Uses "inspectionDocument" as parent entity
-- - "balloon" stores both the selection region and the circle label in one row
-- - Enforces tenant consistency with composite (id, companyId) foreign keys

CREATE TABLE "inspectionDocument" (
  "id" TEXT NOT NULL DEFAULT id('idc'),
  "companyId" TEXT NOT NULL,
  "partId" TEXT NOT NULL,
  "drawingNumber" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "storagePath" TEXT,
  "fileName" TEXT,
  "pageCount" INTEGER,
  "defaultPageWidth" DOUBLE PRECISION,
  "defaultPageHeight" DOUBLE PRECISION,
  "uploadedBy" TEXT,
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE,

  CONSTRAINT "inspectionDocument_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "inspectionDocument_id_unique" UNIQUE ("id"),
  CONSTRAINT "inspectionDocument_version_check" CHECK ("version" >= 0),
  CONSTRAINT "inspectionDocument_pageCount_check" CHECK ("pageCount" > 0),
  CONSTRAINT "inspectionDocument_defaultPageWidth_check" CHECK ("defaultPageWidth" > 0),
  CONSTRAINT "inspectionDocument_defaultPageHeight_check" CHECK ("defaultPageHeight" > 0),

  CONSTRAINT "inspectionDocument_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inspectionDocument_partId_fkey"
    FOREIGN KEY ("partId") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inspectionDocument_uploadedBy_fkey"
    FOREIGN KEY ("uploadedBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "inspectionDocument_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "inspectionDocument_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON UPDATE CASCADE
);

CREATE TABLE "balloon" (
  "id" TEXT NOT NULL DEFAULT id('bbn'),
  "inspectionDocumentId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "pageNumber" INTEGER NOT NULL,
  "regionX" DOUBLE PRECISION NOT NULL,
  "regionY" DOUBLE PRECISION NOT NULL,
  "regionWidth" DOUBLE PRECISION NOT NULL,
  "regionHeight" DOUBLE PRECISION NOT NULL,
  "label" TEXT NOT NULL,
  "xCoordinate" DOUBLE PRECISION NOT NULL,
  "yCoordinate" DOUBLE PRECISION NOT NULL,
  "description" TEXT,
  "nominalValue" TEXT,
  "tolerancePlus" TEXT,
  "toleranceMinus" TEXT,
  "unit" TEXT,
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE,

  CONSTRAINT "balloon_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "balloon_id_unique" UNIQUE ("id"),
  CONSTRAINT "balloon_pageNumber_check" CHECK ("pageNumber" > 0),
  CONSTRAINT "balloon_regionX_check" CHECK ("regionX" >= 0 AND "regionX" <= 1),
  CONSTRAINT "balloon_regionY_check" CHECK ("regionY" >= 0 AND "regionY" <= 1),
  CONSTRAINT "balloon_regionWidth_check" CHECK ("regionWidth" > 0 AND "regionWidth" <= 1),
  CONSTRAINT "balloon_regionHeight_check" CHECK ("regionHeight" > 0 AND "regionHeight" <= 1),
  CONSTRAINT "balloon_region_xw_bounds_check" CHECK ("regionX" + "regionWidth" <= 1),
  CONSTRAINT "balloon_region_yh_bounds_check" CHECK ("regionY" + "regionHeight" <= 1),
  CONSTRAINT "balloon_xCoordinate_check" CHECK ("xCoordinate" >= 0 AND "xCoordinate" <= 1),
  CONSTRAINT "balloon_yCoordinate_check" CHECK ("yCoordinate" >= 0 AND "yCoordinate" <= 1),

  CONSTRAINT "balloon_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "balloon_document_company_fkey"
    FOREIGN KEY ("inspectionDocumentId", "companyId")
    REFERENCES "inspectionDocument"("id", "companyId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "balloon_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "balloon_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON UPDATE CASCADE
);

CREATE INDEX "inspectionDocument_companyId_idx" ON "inspectionDocument" ("companyId");
CREATE INDEX "inspectionDocument_partId_idx" ON "inspectionDocument" ("partId");

CREATE INDEX "balloon_companyId_idx" ON "balloon" ("companyId");
CREATE INDEX "balloon_inspectionDocumentId_idx" ON "balloon" ("inspectionDocumentId");
CREATE INDEX "balloon_document_page_idx" ON "balloon" ("inspectionDocumentId", "companyId", "pageNumber");
CREATE INDEX "balloon_active_document_idx"
  ON "balloon" ("inspectionDocumentId", "companyId")
  WHERE "deletedAt" IS NULL;

CREATE OR REPLACE FUNCTION enforce_unique_balloon_label_per_page()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "balloon"
    WHERE "inspectionDocumentId" = NEW."inspectionDocumentId"
      AND "companyId" = NEW."companyId"
      AND "pageNumber" = NEW."pageNumber"
      AND "label" = NEW."label"
      AND "deletedAt" IS NULL
      AND "id" <> COALESCE(NEW."id", '')
  ) THEN
    RAISE EXCEPTION 'duplicate balloon label "%" on inspectionDocument page %', NEW."label", NEW."pageNumber";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_balloon_unique_label_per_page"
BEFORE INSERT OR UPDATE OF "inspectionDocumentId", "pageNumber", "label", "deletedAt"
ON "balloon"
FOR EACH ROW
WHEN (NEW."deletedAt" IS NULL)
EXECUTE FUNCTION enforce_unique_balloon_label_per_page();

ALTER TABLE "inspectionDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "balloon" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SELECT" ON "public"."inspectionDocument"
FOR SELECT USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_role()
    )::text[]
  )
);

CREATE POLICY "INSERT" ON "public"."inspectionDocument"
FOR INSERT WITH CHECK (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_create')
    )::text[]
  )
);

CREATE POLICY "UPDATE" ON "public"."inspectionDocument"
FOR UPDATE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_update')
    )::text[]
  )
);

CREATE POLICY "DELETE" ON "public"."inspectionDocument"
FOR DELETE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_delete')
    )::text[]
  )
);

CREATE POLICY "SELECT" ON "public"."balloon"
FOR SELECT USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_role()
    )::text[]
  )
);

CREATE POLICY "INSERT" ON "public"."balloon"
FOR INSERT WITH CHECK (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_create')
    )::text[]
  )
);

CREATE POLICY "UPDATE" ON "public"."balloon"
FOR UPDATE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_update')
    )::text[]
  )
);

CREATE POLICY "DELETE" ON "public"."balloon"
FOR DELETE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_delete')
    )::text[]
  )
);

