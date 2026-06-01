-- F12-K59: B2B contacts (CRM-lite). Workspace-scoped. A row can represent a
-- person (firstName/lastName/email/phone), a company (companyName/NIP/REGON),
-- or both — fields are all nullable so the user can fill what makes sense.

CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "ownerId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "companyName" TEXT,
    "nip" TEXT,
    "regon" TEXT,
    "vatNumber" TEXT,
    "website" TEXT,
    "street" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT DEFAULT 'PL',
    "notesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contact_workspaceId_deletedAt_idx" ON "Contact"("workspaceId", "deletedAt");
CREATE INDEX "Contact_workspaceId_companyName_idx" ON "Contact"("workspaceId", "companyName");
CREATE INDEX "Contact_workspaceId_lastName_idx" ON "Contact"("workspaceId", "lastName");

ALTER TABLE "Contact"
    ADD CONSTRAINT "Contact_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact"
    ADD CONSTRAINT "Contact_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "Contact"
    ADD CONSTRAINT "Contact_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON UPDATE CASCADE;
