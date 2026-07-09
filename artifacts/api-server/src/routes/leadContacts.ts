import { Router } from "express";
import { db } from "@workspace/db";
import { leadContactsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";

const router = Router();

router.get("/:id/contacts", asyncHandler(async (req, res) => {
  const rows = await db
    .select()
    .from(leadContactsTable)
    .where(eq(leadContactsTable.leadId, (req.params as { id: string }).id))
    .orderBy(desc(leadContactsTable.createdAt));
  return res.json(rows);
}));

router.post("/:id/contacts", asyncHandler(async (req, res) => {
  const { type, subject, body } = req.body as { type?: string; subject: string; body?: string };
  if (!subject) throw createError("subject is required", 400);
  const [row] = await db
    .insert(leadContactsTable)
    .values({ leadId: (req.params as { id: string }).id, type: type ?? "NOTE", subject, body })
    .returning();
  return res.status(201).json(row);
}));

router.delete("/:id/contacts/:contactId", asyncHandler(async (req, res) => {
  await db
    .delete(leadContactsTable)
    .where(eq(leadContactsTable.id, (req.params as { contactId: string }).contactId));
  return res.status(204).send();
}));

export default router;
