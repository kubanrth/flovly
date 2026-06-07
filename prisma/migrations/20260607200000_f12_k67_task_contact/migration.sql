-- F12-K67: powiązanie task'a z kontaktem CRM. Pokazuje task'a w sekcji
-- "Zadania" w karcie kontaktu. ON DELETE SET NULL żeby task nie znikał
-- razem z kontaktem (kontakt może odejść, robota zostaje).

ALTER TABLE "Task" ADD COLUMN "contactId" TEXT;

CREATE INDEX "Task_contactId_idx" ON "Task"("contactId");

ALTER TABLE "Task"
    ADD CONSTRAINT "Task_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
