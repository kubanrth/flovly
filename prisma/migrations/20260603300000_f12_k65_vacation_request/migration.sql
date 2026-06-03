-- F12-K65: VacationRequest — global (cross-workspace) urlop wnioski. Decyduje
-- super admin. status discriminuje pending/approved/rejected/cancelled.

CREATE TABLE "VacationRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VacationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VacationRequest_requesterId_startDate_idx"
    ON "VacationRequest"("requesterId", "startDate");
CREATE INDEX "VacationRequest_status_idx" ON "VacationRequest"("status");
CREATE INDEX "VacationRequest_startDate_idx" ON "VacationRequest"("startDate");

ALTER TABLE "VacationRequest"
    ADD CONSTRAINT "VacationRequest_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VacationRequest"
    ADD CONSTRAINT "VacationRequest_decidedById_fkey"
    FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON UPDATE CASCADE;
