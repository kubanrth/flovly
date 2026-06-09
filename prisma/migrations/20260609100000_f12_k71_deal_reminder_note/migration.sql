-- F12-K71: opcjonalna treść do przypomnienia na deal'u. Cron sklejka w
-- template emaila jako blockquote pod tytułem.

ALTER TABLE "Deal" ADD COLUMN "reminderNote" TEXT;
