-- F12-K66: przypomnienia na dealach. Mirror Task.reminderAt / reminderSentAt.
-- Cron /api/cron/send-reminders rozszerzony żeby skanował też deale.

ALTER TABLE "Deal" ADD COLUMN "reminderAt" TIMESTAMP(3);
ALTER TABLE "Deal" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- Index analogiczny do Task (reminderAt, reminderSentAt) — cron czyta po
-- both indeks pozwala mu znaleźć "due ale jeszcze nie wysłane" bez full
-- scan'a tabeli.
CREATE INDEX "Deal_reminderAt_reminderSentAt_idx"
    ON "Deal"("reminderAt", "reminderSentAt");
