-- F12-K134: scope custom named views.
-- Milestone.boardViewId: null = default roadmapa, set = milestone należy
-- tylko do custom ROADMAP view'a. Bez FK — view delete zostawia milestone
-- widoczny na default roadmapie (patrz komentarz w schema.prisma).

ALTER TABLE "Milestone" ADD COLUMN "boardViewId" TEXT;
