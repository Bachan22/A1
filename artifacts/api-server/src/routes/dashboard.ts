import { Router } from "express";
import { db } from "@workspace/db";
import {
  clientsTable, projectsTable, leadsTable, tasksTable, invoicesTable,
} from "@workspace/db/schema";
import { eq, gte, sql, and, lte } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.get("/stats", asyncHandler(async (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [
    [{ totalClients }],
    [{ activeProjects }],
    [{ openLeads }],
    [{ revenuePaid }],
    [{ outstanding }],
    [{ monthlyRevenue }],
    [{ tasksDue }],
  ] = await Promise.all([
    db.select({ totalClients: sql<number>`count(*)::int` }).from(clientsTable),
    db.select({ activeProjects: sql<number>`count(*)::int` }).from(projectsTable).where(eq(projectsTable.status, "IN_PROGRESS")),
    db.select({ openLeads: sql<number>`count(*)::int` }).from(leadsTable).where(sql`${leadsTable.stage} not in ('CLOSED_WON','CLOSED_LOST','WON','LOST')`),
    db.select({ revenuePaid: sql<number>`coalesce(sum(total),0)::float` }).from(invoicesTable).where(eq(invoicesTable.status, "PAID")),
    db.select({ outstanding: sql<number>`coalesce(sum(total),0)::float` }).from(invoicesTable).where(sql`${invoicesTable.status} in ('SENT','DRAFT','OVERDUE')`),
    db.select({ monthlyRevenue: sql<number>`coalesce(sum(total),0)::float` }).from(invoicesTable).where(and(eq(invoicesTable.status, "PAID"), gte(invoicesTable.invoiceDate, monthStart))),
    db.select({ tasksDue: sql<number>`count(*)::int` }).from(tasksTable).where(and(sql`${tasksTable.status} != 'DONE'`, lte(tasksTable.dueDate, today))),
  ]);

  return res.json({ totalClients, activeProjects, openLeads, revenuePaid, outstanding, monthlyRevenue, tasksDue });
}));

router.get("/revenue-chart", asyncHandler(async (req, res) => {
  const now = new Date();
  const range = (req.query.range as string) ?? "6m";

  let monthCount = 6;
  let startDate: Date;

  if (range === "3m") {
    monthCount = 3;
    startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  } else if (range === "12m") {
    monthCount = 12;
    startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  } else if (range === "ytd") {
    startDate = new Date(now.getFullYear(), 0, 1);
    monthCount = now.getMonth() + 1;
  } else {
    monthCount = 6;
    startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  }

  const months: Record<string, number> = {};
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months[d.toLocaleString("default", { month: "short", year: "2-digit" })] = 0;
  }

  const startStr = startDate.toISOString().slice(0, 10);

  const invoices = await db
    .select({ invoiceDate: invoicesTable.invoiceDate, total: invoicesTable.total })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.status, "PAID"), gte(invoicesTable.invoiceDate, startStr)));

  for (const inv of invoices) {
    if (inv.invoiceDate) {
      const key = new Date(inv.invoiceDate).toLocaleString("default", { month: "short", year: "2-digit" });
      if (key in months) months[key] += inv.total ?? 0;
    }
  }
  return res.json(Object.entries(months).map(([month, amount]) => ({ month, amount })));
}));

router.get("/project-health", asyncHandler(async (req, res) => {
  const projects = await db
    .select({ status: projectsTable.status })
    .from(projectsTable);

  let onTrack = 0;
  let atRisk = 0;
  let delayed = 0;
  let completed = 0;

  for (const p of projects) {
    const s = p.status ?? "";
    if (s === "COMPLETED") { completed++; }
    else if (s === "ON_HOLD" || s === "CANCELLED") { delayed++; }
    else if (s === "IN_PROGRESS") { onTrack++; }
    else { atRisk++; }
  }

  return res.json({ onTrack, atRisk, delayed, completed, total: projects.length });
}));

router.get("/recent-activity", asyncHandler(async (req, res) => {
  const [clients, projects, invoices] = await Promise.all([
    db.select({ id: clientsTable.id, companyName: clientsTable.companyName, createdAt: clientsTable.createdAt }).from(clientsTable).orderBy(sql`created_at desc`).limit(3),
    db.select({ id: projectsTable.id, name: projectsTable.name, createdAt: projectsTable.createdAt }).from(projectsTable).orderBy(sql`created_at desc`).limit(3),
    db.select({ id: invoicesTable.id, number: invoicesTable.number, status: invoicesTable.status, createdAt: invoicesTable.createdAt }).from(invoicesTable).orderBy(sql`created_at desc`).limit(3),
  ]);

  const activity = [
    ...clients.map((c) => ({ id: `client-${c.id}`, type: "client", message: `Client ${c.companyName} added`, createdAt: c.createdAt?.toISOString() ?? new Date().toISOString() })),
    ...projects.map((p) => ({ id: `project-${p.id}`, type: "project", message: `Project "${p.name}" created`, createdAt: p.createdAt?.toISOString() ?? new Date().toISOString() })),
    ...invoices.map((i) => ({ id: `invoice-${i.id}`, type: "invoice", message: `Invoice ${i.number ?? ""} ${i.status?.toLowerCase()}`, createdAt: i.createdAt?.toISOString() ?? new Date().toISOString() })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  return res.json(activity);
}));

export default router;
