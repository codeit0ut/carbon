-- Balloon document tables
-- - Uses "balloonDocument" as parent entity
-- - "balloon" derives page from linked selector (no pageNumber column)
-- - Enforces tenant consistency with composite (id, companyId) foreign keys

CREATE TABLE "balloonDocument" (
  "id" TEXT NOT NULL DEFAULT id('bdr'),
  "companyId" TEXT NOT NULL,
  "qualityDocumentId" TEXT NOT NULL,
  "drawingNumber" TEXT,
  "revision" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "storagePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "pageCount" INTEGER,
  "defaultPageWidth" DOUBLE PRECISION,
  "defaultPageHeight" DOUBLE PRECISION,
  "uploadedBy" TEXT NOT NULL,
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE,

  CONSTRAINT "balloonDocument_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "balloonDocument_id_unique" UNIQUE ("id"),
  CONSTRAINT "balloonDocument_version_check" CHECK ("version" >= 0),
  CONSTRAINT "balloonDocument_pageCount_check" CHECK ("pageCount" > 0),
  CONSTRAINT "balloonDocument_defaultPageWidth_check" CHECK ("defaultPageWidth" > 0),
  CONSTRAINT "balloonDocument_defaultPageHeight_check" CHECK ("defaultPageHeight" > 0),

  CONSTRAINT "balloonDocument_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "balloonDocument_qualityDocumentId_fkey"
    FOREIGN KEY ("qualityDocumentId") REFERENCES "qualityDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "balloonDocument_uploadedBy_fkey"
    FOREIGN KEY ("uploadedBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "balloonDocument_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "balloonDocument_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON UPDATE CASCADE
);

CREATE TABLE "balloonAnchor" (
  "id" TEXT NOT NULL DEFAULT id('bsl'),
  "drawingId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "pageNumber" INTEGER NOT NULL,
  "xCoordinate" DOUBLE PRECISION NOT NULL,
  "yCoordinate" DOUBLE PRECISION NOT NULL,
  "width" DOUBLE PRECISION NOT NULL,
  "height" DOUBLE PRECISION NOT NULL,
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE,

  CONSTRAINT "balloonAnchor_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "balloonAnchor_id_unique" UNIQUE ("id"),
  CONSTRAINT "balloonAnchor_pageNumber_check" CHECK ("pageNumber" > 0),
  CONSTRAINT "balloonAnchor_xCoordinate_check" CHECK ("xCoordinate" >= 0 AND "xCoordinate" <= 1),
  CONSTRAINT "balloonAnchor_yCoordinate_check" CHECK ("yCoordinate" >= 0 AND "yCoordinate" <= 1),
  CONSTRAINT "balloonAnchor_width_check" CHECK ("width" > 0 AND "width" <= 1),
  CONSTRAINT "balloonAnchor_height_check" CHECK ("height" > 0 AND "height" <= 1),
  CONSTRAINT "balloonAnchor_xw_bounds_check" CHECK ("xCoordinate" + "width" <= 1),
  CONSTRAINT "balloonAnchor_yh_bounds_check" CHECK ("yCoordinate" + "height" <= 1),

  CONSTRAINT "balloonAnchor_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "balloonAnchor_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "balloonAnchor_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "balloonAnchor_drawing_company_fkey"
    FOREIGN KEY ("drawingId", "companyId")
    REFERENCES "balloonDocument"("id", "companyId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "balloon" (
  "id" TEXT NOT NULL DEFAULT id('bbn'),
  "selectorId" TEXT NOT NULL,
  "drawingId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "xCoordinate" DOUBLE PRECISION NOT NULL,
  "yCoordinate" DOUBLE PRECISION NOT NULL,
  "anchorX" DOUBLE PRECISION,
  "anchorY" DOUBLE PRECISION,
  "description" TEXT,
  "data" JSONB,
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE,

  CONSTRAINT "balloon_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "balloon_id_unique" UNIQUE ("id"),
  CONSTRAINT "balloon_selectorId_unique" UNIQUE ("selectorId"),
  CONSTRAINT "balloon_xCoordinate_check" CHECK ("xCoordinate" >= 0 AND "xCoordinate" <= 1),
  CONSTRAINT "balloon_yCoordinate_check" CHECK ("yCoordinate" >= 0 AND "yCoordinate" <= 1),
  CONSTRAINT "balloon_anchorX_check" CHECK ("anchorX" IS NULL OR ("anchorX" >= 0 AND "anchorX" <= 1)),
  CONSTRAINT "balloon_anchorY_check" CHECK ("anchorY" IS NULL OR ("anchorY" >= 0 AND "anchorY" <= 1)),

  CONSTRAINT "balloon_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "balloon_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "balloon_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "balloon_drawing_company_fkey"
    FOREIGN KEY ("drawingId", "companyId")
    REFERENCES "balloonDocument"("id", "companyId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "balloon_selector_company_fkey"
    FOREIGN KEY ("selectorId", "companyId")
    REFERENCES "balloonAnchor"("id", "companyId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "balloonAnnotation" (
  "id" TEXT NOT NULL DEFAULT id('ban'),
  "drawingId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "pageNumber" INTEGER NOT NULL,
  "xCoordinate" DOUBLE PRECISION NOT NULL,
  "yCoordinate" DOUBLE PRECISION NOT NULL,
  "text" TEXT NOT NULL,
  "width" DOUBLE PRECISION,
  "height" DOUBLE PRECISION,
  "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "style" JSONB,
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE,

  CONSTRAINT "balloonAnnotation_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "balloonAnnotation_id_unique" UNIQUE ("id"),
  CONSTRAINT "balloonAnnotation_pageNumber_check" CHECK ("pageNumber" > 0),
  CONSTRAINT "balloonAnnotation_xCoordinate_check" CHECK ("xCoordinate" >= 0 AND "xCoordinate" <= 1),
  CONSTRAINT "balloonAnnotation_yCoordinate_check" CHECK ("yCoordinate" >= 0 AND "yCoordinate" <= 1),
  CONSTRAINT "balloonAnnotation_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "balloonAnnotation_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "balloonAnnotation_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "balloonAnnotation_drawing_company_fkey"
    FOREIGN KEY ("drawingId", "companyId")
    REFERENCES "balloonDocument"("id", "companyId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "balloonDocument_companyId_idx" ON "balloonDocument" ("companyId");
CREATE INDEX "balloonDocument_qualityDocumentId_idx" ON "balloonDocument" ("qualityDocumentId");

CREATE INDEX "balloonAnchor_companyId_idx" ON "balloonAnchor" ("companyId");
CREATE INDEX "balloonAnchor_drawingId_idx" ON "balloonAnchor" ("drawingId");
CREATE INDEX "balloonAnchor_drawing_page_idx" ON "balloonAnchor" ("drawingId", "companyId", "pageNumber");
CREATE INDEX "balloonAnchor_active_page_idx"
  ON "balloonAnchor" ("drawingId", "companyId", "pageNumber")
  WHERE "deletedAt" IS NULL;

CREATE INDEX "balloon_companyId_idx" ON "balloon" ("companyId");
CREATE INDEX "balloon_drawingId_idx" ON "balloon" ("drawingId");
CREATE INDEX "balloon_selectorId_idx" ON "balloon" ("selectorId");
CREATE INDEX "balloon_active_drawing_idx"
  ON "balloon" ("drawingId", "companyId")
  WHERE "deletedAt" IS NULL;

CREATE INDEX "balloonAnnotation_companyId_idx" ON "balloonAnnotation" ("companyId");
CREATE INDEX "balloonAnnotation_drawing_page_idx" ON "balloonAnnotation" ("drawingId", "companyId", "pageNumber");
CREATE INDEX "balloonAnnotation_active_page_idx"
  ON "balloonAnnotation" ("drawingId", "companyId", "pageNumber")
  WHERE "deletedAt" IS NULL;

CREATE OR REPLACE FUNCTION enforce_unique_balloon_label_per_page()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_page_number INTEGER;
  v_conflict_id TEXT;
BEGIN
  SELECT s."pageNumber"
    INTO v_page_number
  FROM "balloonAnchor" s
  WHERE s."id" = NEW."selectorId"
    AND s."companyId" = NEW."companyId"
    AND s."deletedAt" IS NULL;

  IF v_page_number IS NULL THEN
    RAISE EXCEPTION 'selector % not found or deleted for company %', NEW."selectorId", NEW."companyId";
  END IF;

  SELECT b."id"
    INTO v_conflict_id
  FROM "balloon" b
  JOIN "balloonAnchor" s ON s."id" = b."selectorId" AND s."companyId" = b."companyId"
  WHERE b."drawingId" = NEW."drawingId"
    AND b."companyId" = NEW."companyId"
    AND b."label" = NEW."label"
    AND s."pageNumber" = v_page_number
    AND b."deletedAt" IS NULL
    AND s."deletedAt" IS NULL
    AND b."id" <> COALESCE(NEW."id", '')
  LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'duplicate balloon label "%" on drawing "%" page %', NEW."label", NEW."drawingId", v_page_number;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_balloon_unique_label_per_page"
BEFORE INSERT OR UPDATE OF "selectorId", "drawingId", "label", "deletedAt"
ON "balloon"
FOR EACH ROW
WHEN (NEW."deletedAt" IS NULL)
EXECUTE FUNCTION enforce_unique_balloon_label_per_page();

ALTER TABLE "balloonDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "balloonAnchor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "balloon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "balloonAnnotation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SELECT" ON "public"."balloonDocument"
FOR SELECT USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_role()
    )::text[]
  )
);

CREATE POLICY "INSERT" ON "public"."balloonDocument"
FOR INSERT WITH CHECK (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_create')
    )::text[]
  )
);

CREATE POLICY "UPDATE" ON "public"."balloonDocument"
FOR UPDATE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_update')
    )::text[]
  )
);

CREATE POLICY "DELETE" ON "public"."balloonDocument"
FOR DELETE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_delete')
    )::text[]
  )
);

CREATE POLICY "SELECT" ON "public"."balloonAnchor"
FOR SELECT USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_role()
    )::text[]
  )
);

CREATE POLICY "INSERT" ON "public"."balloonAnchor"
FOR INSERT WITH CHECK (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_create')
    )::text[]
  )
);

CREATE POLICY "UPDATE" ON "public"."balloonAnchor"
FOR UPDATE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_update')
    )::text[]
  )
);

CREATE POLICY "DELETE" ON "public"."balloonAnchor"
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

CREATE POLICY "SELECT" ON "public"."balloonAnnotation"
FOR SELECT USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_role()
    )::text[]
  )
);

CREATE POLICY "INSERT" ON "public"."balloonAnnotation"
FOR INSERT WITH CHECK (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_create')
    )::text[]
  )
);

CREATE POLICY "UPDATE" ON "public"."balloonAnnotation"
FOR UPDATE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_update')
    )::text[]
  )
);

CREATE POLICY "DELETE" ON "public"."balloonAnnotation"
FOR DELETE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_delete')
    )::text[]
  )
);
