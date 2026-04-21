-- Ballooning tables
-- - Uses "ballooningDrawing" as parent entity
-- - "ballooningBalloon" derives page from linked selector (no pageNumber column)
-- - Enforces tenant consistency with composite (id, companyId) foreign keys

CREATE TABLE "ballooningDrawing" (
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

  CONSTRAINT "ballooningDrawing_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "ballooningDrawing_id_unique" UNIQUE ("id"),
  CONSTRAINT "ballooningDrawing_version_check" CHECK ("version" >= 0),
  CONSTRAINT "ballooningDrawing_pageCount_check" CHECK ("pageCount" > 0),
  CONSTRAINT "ballooningDrawing_defaultPageWidth_check" CHECK ("defaultPageWidth" > 0),
  CONSTRAINT "ballooningDrawing_defaultPageHeight_check" CHECK ("defaultPageHeight" > 0),

  CONSTRAINT "ballooningDrawing_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ballooningDrawing_qualityDocumentId_fkey"
    FOREIGN KEY ("qualityDocumentId") REFERENCES "qualityDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ballooningDrawing_uploadedBy_fkey"
    FOREIGN KEY ("uploadedBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "ballooningDrawing_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "ballooningDrawing_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON UPDATE CASCADE
);

CREATE TABLE "ballooningSelector" (
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

  CONSTRAINT "ballooningSelector_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "ballooningSelector_id_unique" UNIQUE ("id"),
  CONSTRAINT "ballooningSelector_pageNumber_check" CHECK ("pageNumber" > 0),
  CONSTRAINT "ballooningSelector_xCoordinate_check" CHECK ("xCoordinate" >= 0 AND "xCoordinate" <= 1),
  CONSTRAINT "ballooningSelector_yCoordinate_check" CHECK ("yCoordinate" >= 0 AND "yCoordinate" <= 1),
  CONSTRAINT "ballooningSelector_width_check" CHECK ("width" > 0 AND "width" <= 1),
  CONSTRAINT "ballooningSelector_height_check" CHECK ("height" > 0 AND "height" <= 1),
  CONSTRAINT "ballooningSelector_xw_bounds_check" CHECK ("xCoordinate" + "width" <= 1),
  CONSTRAINT "ballooningSelector_yh_bounds_check" CHECK ("yCoordinate" + "height" <= 1),

  CONSTRAINT "ballooningSelector_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ballooningSelector_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "ballooningSelector_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "ballooningSelector_drawing_company_fkey"
    FOREIGN KEY ("drawingId", "companyId")
    REFERENCES "ballooningDrawing"("id", "companyId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ballooningBalloon" (
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

  CONSTRAINT "ballooningBalloon_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "ballooningBalloon_id_unique" UNIQUE ("id"),
  CONSTRAINT "ballooningBalloon_selectorId_unique" UNIQUE ("selectorId"),
  CONSTRAINT "ballooningBalloon_xCoordinate_check" CHECK ("xCoordinate" >= 0 AND "xCoordinate" <= 1),
  CONSTRAINT "ballooningBalloon_yCoordinate_check" CHECK ("yCoordinate" >= 0 AND "yCoordinate" <= 1),
  CONSTRAINT "ballooningBalloon_anchorX_check" CHECK ("anchorX" IS NULL OR ("anchorX" >= 0 AND "anchorX" <= 1)),
  CONSTRAINT "ballooningBalloon_anchorY_check" CHECK ("anchorY" IS NULL OR ("anchorY" >= 0 AND "anchorY" <= 1)),

  CONSTRAINT "ballooningBalloon_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ballooningBalloon_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "ballooningBalloon_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "ballooningBalloon_drawing_company_fkey"
    FOREIGN KEY ("drawingId", "companyId")
    REFERENCES "ballooningDrawing"("id", "companyId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ballooningBalloon_selector_company_fkey"
    FOREIGN KEY ("selectorId", "companyId")
    REFERENCES "ballooningSelector"("id", "companyId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ballooningAnnotation" (
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

  CONSTRAINT "ballooningAnnotation_pkey" PRIMARY KEY ("id", "companyId"),
  CONSTRAINT "ballooningAnnotation_id_unique" UNIQUE ("id"),
  CONSTRAINT "ballooningAnnotation_pageNumber_check" CHECK ("pageNumber" > 0),
  CONSTRAINT "ballooningAnnotation_xCoordinate_check" CHECK ("xCoordinate" >= 0 AND "xCoordinate" <= 1),
  CONSTRAINT "ballooningAnnotation_yCoordinate_check" CHECK ("yCoordinate" >= 0 AND "yCoordinate" <= 1),
  CONSTRAINT "ballooningAnnotation_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ballooningAnnotation_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "ballooningAnnotation_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "user"("id") ON UPDATE CASCADE,
  CONSTRAINT "ballooningAnnotation_drawing_company_fkey"
    FOREIGN KEY ("drawingId", "companyId")
    REFERENCES "ballooningDrawing"("id", "companyId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ballooningDrawing_companyId_idx" ON "ballooningDrawing" ("companyId");
CREATE INDEX "ballooningDrawing_qualityDocumentId_idx" ON "ballooningDrawing" ("qualityDocumentId");

CREATE INDEX "ballooningSelector_companyId_idx" ON "ballooningSelector" ("companyId");
CREATE INDEX "ballooningSelector_drawingId_idx" ON "ballooningSelector" ("drawingId");
CREATE INDEX "ballooningSelector_drawing_page_idx" ON "ballooningSelector" ("drawingId", "companyId", "pageNumber");
CREATE INDEX "ballooningSelector_active_page_idx"
  ON "ballooningSelector" ("drawingId", "companyId", "pageNumber")
  WHERE "deletedAt" IS NULL;

CREATE INDEX "ballooningBalloon_companyId_idx" ON "ballooningBalloon" ("companyId");
CREATE INDEX "ballooningBalloon_drawingId_idx" ON "ballooningBalloon" ("drawingId");
CREATE INDEX "ballooningBalloon_selectorId_idx" ON "ballooningBalloon" ("selectorId");
CREATE INDEX "ballooningBalloon_active_drawing_idx"
  ON "ballooningBalloon" ("drawingId", "companyId")
  WHERE "deletedAt" IS NULL;

CREATE INDEX "ballooningAnnotation_companyId_idx" ON "ballooningAnnotation" ("companyId");
CREATE INDEX "ballooningAnnotation_drawing_page_idx" ON "ballooningAnnotation" ("drawingId", "companyId", "pageNumber");
CREATE INDEX "ballooningAnnotation_active_page_idx"
  ON "ballooningAnnotation" ("drawingId", "companyId", "pageNumber")
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
  FROM "ballooningSelector" s
  WHERE s."id" = NEW."selectorId"
    AND s."companyId" = NEW."companyId"
    AND s."deletedAt" IS NULL;

  IF v_page_number IS NULL THEN
    RAISE EXCEPTION 'selector % not found or deleted for company %', NEW."selectorId", NEW."companyId";
  END IF;

  SELECT b."id"
    INTO v_conflict_id
  FROM "ballooningBalloon" b
  JOIN "ballooningSelector" s ON s."id" = b."selectorId" AND s."companyId" = b."companyId"
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
ON "ballooningBalloon"
FOR EACH ROW
WHEN (NEW."deletedAt" IS NULL)
EXECUTE FUNCTION enforce_unique_balloon_label_per_page();

ALTER TABLE "ballooningDrawing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ballooningSelector" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ballooningBalloon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ballooningAnnotation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SELECT" ON "public"."ballooningDrawing"
FOR SELECT USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_role()
    )::text[]
  )
);

CREATE POLICY "INSERT" ON "public"."ballooningDrawing"
FOR INSERT WITH CHECK (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_create')
    )::text[]
  )
);

CREATE POLICY "UPDATE" ON "public"."ballooningDrawing"
FOR UPDATE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_update')
    )::text[]
  )
);

CREATE POLICY "DELETE" ON "public"."ballooningDrawing"
FOR DELETE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_delete')
    )::text[]
  )
);

CREATE POLICY "SELECT" ON "public"."ballooningSelector"
FOR SELECT USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_role()
    )::text[]
  )
);

CREATE POLICY "INSERT" ON "public"."ballooningSelector"
FOR INSERT WITH CHECK (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_create')
    )::text[]
  )
);

CREATE POLICY "UPDATE" ON "public"."ballooningSelector"
FOR UPDATE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_update')
    )::text[]
  )
);

CREATE POLICY "DELETE" ON "public"."ballooningSelector"
FOR DELETE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_delete')
    )::text[]
  )
);

CREATE POLICY "SELECT" ON "public"."ballooningBalloon"
FOR SELECT USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_role()
    )::text[]
  )
);

CREATE POLICY "INSERT" ON "public"."ballooningBalloon"
FOR INSERT WITH CHECK (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_create')
    )::text[]
  )
);

CREATE POLICY "UPDATE" ON "public"."ballooningBalloon"
FOR UPDATE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_update')
    )::text[]
  )
);

CREATE POLICY "DELETE" ON "public"."ballooningBalloon"
FOR DELETE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_delete')
    )::text[]
  )
);

CREATE POLICY "SELECT" ON "public"."ballooningAnnotation"
FOR SELECT USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_role()
    )::text[]
  )
);

CREATE POLICY "INSERT" ON "public"."ballooningAnnotation"
FOR INSERT WITH CHECK (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_create')
    )::text[]
  )
);

CREATE POLICY "UPDATE" ON "public"."ballooningAnnotation"
FOR UPDATE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_update')
    )::text[]
  )
);

CREATE POLICY "DELETE" ON "public"."ballooningAnnotation"
FOR DELETE USING (
  "companyId" = ANY (
    (
      SELECT
        get_companies_with_employee_permission('quality_delete')
    )::text[]
  )
);
