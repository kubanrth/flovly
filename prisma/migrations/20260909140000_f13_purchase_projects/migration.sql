-- F13: Zapotrzebowanie przechodzi z nazwy projektu wpisywanej ręcznie na projekt
-- przestrzeni (ta sama tabela co w Subskrypcjach), bo to lista osób z projektu
-- decyduje, kto widzi zgłoszenia.
ALTER TABLE "PurchaseRequest" ADD COLUMN "projectId" TEXT;

-- Każda dotąd wpisana nazwa dostaje projekt (jeśli takiego jeszcze nie ma).
INSERT INTO "SubscriptionProject" ("id", "workspaceId", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, d."workspaceId", d."project", now(), now()
FROM (
  SELECT DISTINCT "workspaceId", "project"
  FROM "PurchaseRequest"
  WHERE "deletedAt" IS NULL AND btrim("project") <> ''
) d
WHERE NOT EXISTS (
  SELECT 1 FROM "SubscriptionProject" p
  WHERE p."workspaceId" = d."workspaceId" AND p."name" = d."project" AND p."deletedAt" IS NULL
);

UPDATE "PurchaseRequest" r
SET "projectId" = p."id"
FROM "SubscriptionProject" p
WHERE p."workspaceId" = r."workspaceId" AND p."name" = r."project" AND p."deletedAt" IS NULL;

ALTER TABLE "PurchaseRequest" DROP COLUMN "project";
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SubscriptionProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "PurchaseRequest_projectId_idx" ON "PurchaseRequest"("projectId");
