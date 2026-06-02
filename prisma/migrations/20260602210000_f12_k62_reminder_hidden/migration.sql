-- F12-K62: recipient-only soft-hide for personal reminders. Lets the receiver
-- clear a reminder from their /my/reminders list without affecting the
-- creator's view. Only the creator can hard-delete.

ALTER TABLE "PersonalReminder" ADD COLUMN "recipientHiddenAt" TIMESTAMP(3);

-- Speeds up the recipient list query (filters on recipientId + hidden + dueAt).
CREATE INDEX "PersonalReminder_recipientId_recipientHiddenAt_idx"
  ON "PersonalReminder"("recipientId", "recipientHiddenAt");
