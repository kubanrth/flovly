-- F15: kategorie zadań per tablica — druga oś grupowania obok milestone'ów.
CREATE TABLE "TaskCategory" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL DEFAULT '#64748B',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskCategory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaskCategory_boardId_order_idx" ON "TaskCategory"("boardId", "order");
ALTER TABLE "TaskCategory" ADD CONSTRAINT "TaskCategory_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task" ADD COLUMN "categoryId" TEXT;
CREATE INDEX "Task_categoryId_idx" ON "Task"("categoryId");
ALTER TABLE "Task" ADD CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaskCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Dotychczasowe „Sekcje" (pole wyboru zakładane przyciskiem na Liście) stają
-- się kategoriami: opcje → wiersze, wartości zadań → categoryId, a widoki
-- pogrupowane po tej kolumnie przełączają się na grupowanie po kategorii.
-- Sama kolumna znika, żeby nie było dwóch bytów o tym samym znaczeniu.
INSERT INTO "TaskCategory" ("id", "boardId", "name", "colorHex", "order")
SELECT gen_random_uuid()::text, c."boardId", o.opt->>'value', COALESCE(o.opt->>'color', '#64748B'), (o.idx - 1)::int
FROM "TableColumn" c
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c."options"->'selectOptions', '[]'::jsonb)) WITH ORDINALITY AS o(opt, idx)
WHERE c."name" = 'Sekcje' AND c."type" = 'SINGLE_SELECT' AND (o.opt->>'value') IS NOT NULL AND (o.opt->>'value') <> '';

UPDATE "Task" t SET "categoryId" = k."id"
FROM "TaskCustomValue" v
JOIN "TableColumn" c ON c."id" = v."columnId" AND c."name" = 'Sekcje' AND c."type" = 'SINGLE_SELECT'
JOIN "TaskCategory" k ON k."boardId" = c."boardId" AND k."name" = v."valueText"
WHERE v."taskId" = t."id" AND t."categoryId" IS NULL;

UPDATE "BoardView" SET "configJson" = jsonb_set("configJson"::jsonb, '{groupBy}', '"category"'::jsonb)
WHERE "configJson" IS NOT NULL
  AND "configJson"::jsonb->>'groupBy' IN (SELECT "id" FROM "TableColumn" WHERE "name" = 'Sekcje' AND "type" = 'SINGLE_SELECT');

DELETE FROM "TableColumn" WHERE "name" = 'Sekcje' AND "type" = 'SINGLE_SELECT';
