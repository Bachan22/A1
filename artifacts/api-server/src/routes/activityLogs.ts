import { Router } from "express";
import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";

const router = Router();

router.get("/clients/:clientId/activity", asyncHandler(async (req, res) => {
  const { clientId } = req.params as { clientId: string };
  const rows = await db
    .select()
    .from(activityLogsTable)
    .where(eq(activityLogsTable.clientId, clientId))
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(50);
  return res.json(rows);
}));

router.post("/clients/:clientId/activity", asyncHandler(async (req, res) => {
  const { clientId } = req.params as { clientId: string };
  const { type, title, description, metadata } = req.body as {
    type: string;
    title: string;
    description?: string;
    metadata?: string;
  };
  if (!type || !title) throw createError("type and title are required", 400);
  const [row] = await db
    .insert(activityLogsTable)
    .values({ clientId, type, title, description, metadata })
    .returning();
  return res.status(201).json(row);
}));

router.delete("/clients/:clientId/activity/:id", asyncHandler(async (req, res) => {
  await db
    .delete(activityLogsTable)
    .where(eq(activityLogsTable.id, (req.params as { id: string }).id));
  return res.status(204).send();
}));

export default router;
