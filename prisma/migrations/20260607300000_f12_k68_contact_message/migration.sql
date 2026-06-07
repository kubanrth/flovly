-- F12-K68: wiadomość email w karcie kontaktu (chat-like UI dla handlowca).
-- v1 outbound only — handlowiec pisze, system wysyła przez Resend do
-- contact.email. Inbound (odbieranie odpowiedzi) na osobny sprint —
-- wymaga webhook'a + dedykowanego subdomain'a.

CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "senderId" TEXT,
    "direction" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT,
    "bodyText" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactMessage_contactId_sentAt_idx"
    ON "ContactMessage"("contactId", "sentAt" DESC);
CREATE INDEX "ContactMessage_workspaceId_idx" ON "ContactMessage"("workspaceId");

ALTER TABLE "ContactMessage"
    ADD CONSTRAINT "ContactMessage_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactMessage"
    ADD CONSTRAINT "ContactMessage_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactMessage"
    ADD CONSTRAINT "ContactMessage_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON UPDATE CASCADE;
