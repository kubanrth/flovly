// Demo seed — run with: npm run db:seed
// Loads DATABASE_URL from .env.

import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { Role, ViewType } from "../lib/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("danielos-demo-2026", 12);

  const admin = await db.user.upsert({
    where: { email: "admin@danielos.local" },
    update: {},
    create: {
      email: "admin@danielos.local",
      name: "Daniel Admin",
      passwordHash,
      isSuperAdmin: true,
      emailVerified: new Date(),
    },
  });

  const member = await db.user.upsert({
    where: { email: "member@danielos.local" },
    update: {},
    create: {
      email: "member@danielos.local",
      name: "Anna Member",
      passwordHash,
      emailVerified: new Date(),
    },
  });

  const workspace = await db.workspace.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Workspace",
      slug: "demo",
      ownerId: admin.id,
    },
  });

  // Memberships — upserted independently so re-seed restores them after
  // smoke tests that remove members (F1d invitations/removals etc.).
  await db.workspaceMembership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: admin.id } },
    update: { role: Role.ADMIN },
    create: { workspaceId: workspace.id, userId: admin.id, role: Role.ADMIN },
  });
  await db.workspaceMembership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: member.id } },
    update: { role: Role.MEMBER },
    create: { workspaceId: workspace.id, userId: member.id, role: Role.MEMBER },
  });

  const board = await db.board.create({
    data: {
      workspaceId: workspace.id,
      creatorId: admin.id,
      name: "Sprint 1",
      description: "Pierwszy sprint demo",
      statusColumns: {
        create: [
          { name: "Do zrobienia", colorHex: "#64748B", order: 0 },
          { name: "W trakcie", colorHex: "#F59E0B", order: 1 },
          { name: "Testy", colorHex: "#3B82F6", order: 2 },
          { name: "Done", colorHex: "#10B981", order: 3 },
        ],
      },
      views: {
        create: [
          { type: ViewType.TABLE, configJson: {}, background: { kind: "color", value: "#F8FAFC" } },
          { type: ViewType.KANBAN, configJson: {}, background: { kind: "color", value: "#F8FAFC" } },
          { type: ViewType.ROADMAP, configJson: {}, background: { kind: "color", value: "#F8FAFC" } },
        ],
      },
    },
    include: { statusColumns: true },
  });

  const urgent = await db.tag.create({
    data: {
      workspaceId: workspace.id,
      name: "urgent",
      colorHex: "#EF4444",
      creatorId: admin.id,
    },
  });

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const m1 = await db.milestone.create({
    data: {
      workspaceId: workspace.id,
      boardId: board.id,
      creatorId: admin.id,
      assigneeId: member.id,
      title: "Brand launch",
      startAt: new Date(now - 7 * day),
      stopAt: new Date(now + 21 * day),
      orderIndex: 0,
    },
  });
  await db.milestone.create({
    data: {
      workspaceId: workspace.id,
      boardId: board.id,
      creatorId: admin.id,
      title: "Public beta",
      startAt: new Date(now + 21 * day),
      stopAt: new Date(now + 60 * day),
      orderIndex: 1,
    },
  });

  await db.task.create({
    data: {
      workspaceId: workspace.id,
      boardId: board.id,
      statusColumnId: board.statusColumns[0].id,
      creatorId: admin.id,
      milestoneId: m1.id,
      title: "Zaprojektować logo DANIELOS",
      rowOrder: 1.0,
      assignees: { create: [{ userId: member.id }] },
      tags: { create: [{ tagId: urgent.id }] },
    },
  });

  // Sample whiteboard — 2 nodes + 1 edge so a fresh DB lands on a non-
  // empty editor the first time a user opens /canvases.
  const canvas = await db.processCanvas.create({
    data: {
      workspaceId: workspace.id,
      creatorId: admin.id,
      name: "Onboarding klienta",
    },
  });
  const nodeA = await db.processNode.create({
    data: {
      canvasId: canvas.id,
      shape: "RECTANGLE",
      label: "Zapytanie",
      x: 80,
      y: 120,
      colorHex: "#DBEAFE",
    },
  });
  const nodeB = await db.processNode.create({
    data: {
      canvasId: canvas.id,
      shape: "DIAMOND",
      label: "Kwalifikacja",
      x: 340,
      y: 120,
      colorHex: "#FEF3C7",
    },
  });
  await db.processEdge.create({
    data: {
      canvasId: canvas.id,
      fromNodeId: nodeA.id,
      toNodeId: nodeB.id,
    },
  });

  // System flags — admin panel /admin/flags shows 5 kill switches. We seed
  // them with their factory defaults so the table never starts empty (a fresh
  // DB otherwise renders defaults-only with no `updatedAt` to display).
  // Catalog source: lib/system-flags.ts. Kept inline (no import) so the seed
  // file stays self-contained and tsx-friendly.
  const flagDefaults: { key: string; value: boolean }[] = [
    { key: "ai_ateron_enabled", value: true },
    { key: "public_share_links", value: true },
    { key: "whiteboard_beta", value: false },
    { key: "import_csv_xls", value: true },
    { key: "kill_switch_writes", value: false },
  ];
  for (const f of flagDefaults) {
    await db.systemFlag.upsert({
      where: { key: f.key },
      update: {},
      create: { key: f.key, value: f.value, updatedBy: admin.id },
    });
  }

  console.log("Seed complete:", { admin: admin.email, member: member.email, workspace: workspace.slug });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
