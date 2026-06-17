-- F12-K73 v3: TaskLineRow — multiple parallel lines per taskline canvas.

CREATE TABLE "TaskLineRow" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Nowa linia',
    "order" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskLineRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskLineRow_canvasId_order_idx" ON "TaskLineRow"("canvasId", "order");

ALTER TABLE "TaskLineRow" ADD CONSTRAINT "TaskLineRow_canvasId_fkey"
    FOREIGN KEY ("canvasId") REFERENCES "ProcessCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
