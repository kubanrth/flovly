-- F12-K83: dodaj flag onboardingCompletedAt do User żeby gateować <OnboardingTour />
-- w (app) layoucie. NULL = nowy user, nie widział toura; DateTime = ukończył / pominął.
-- Backfill istniejących userów (żeby nie widzieli toura od razu po deploy'u): NOW().
ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

UPDATE "User" SET "onboardingCompletedAt" = NOW() WHERE "onboardingCompletedAt" IS NULL;
