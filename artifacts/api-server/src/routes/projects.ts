import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, clientsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate } from "../lib/validation";
import { requirePermission } from "../middleware/auth";

const router = Router();

function sanitizeProject(body: any, isUpdate = false) {
  if (!isUpdate && (!body.name || typeof body.name !== "string" || body.name.trim() === "")) {
    throw createError("Project name is required", 400, undefined, "name");
  }
  if (isUpdate && body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      throw createError("Project name cannot be empty", 400, undefined, "name");
    }
  }
  return sanitizeAndValidate(body, {
    uuids: ["clientId"],
    dates: ["startDate", "dueDate"],
    enums: {
      status: ["NOT_STARTED", "IN_PROGRESS", "UNDER_REVIEW", "COMPLETED", "ON_HOLD", "CANCELLED"],
      priority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
    },
  });
}

router.get("/", requirePermission("projects.view"), asyncHandler(async (req, res) => {
  const rows = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      status: projectsTable.status,
      priority: projectsTable.priority,
      clientId: projectsTable.clientId,
      clientName: clientsTable.companyName,
      startDate: projectsTable.startDate,
      dueDate: projectsTable.dueDate,
      description: projectsTable.description,
    })
    .from(projectsTable)
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id));
  return res.json(rows);
}));

router.post("/", requirePermission("projects.create"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeProject(body, false);
  const [row] = await db.insert(projectsTable).values({ ...sanitized, createdBy: (req as any).userId }).returning();
  return res.status(201).json(row);
}));

router.get("/:id", requirePermission("projects.view"), asyncHandler(async (req, res) => {
  const [row] = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      status: projectsTable.status,
      priority: projectsTable.priority,
      clientId: projectsTable.clientId,
      clientName: clientsTable.companyName,
      startDate: projectsTable.startDate,
      dueDate: projectsTable.dueDate,
      description: projectsTable.description,
      createdBy: projectsTable.createdBy,
    })
    .from(projectsTable)
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
    .where(eq(projectsTable.id, (req.params.id as string)));
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.patch("/:id", requirePermission("projects.edit"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeProject(body, true);
  
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.id as string));
  if (!project) throw createError("Not found", 404);

  const requesterId = (req as any).userId;
  const requesterRole = (req as any).userRole;

  if (requesterRole === "EMPLOYEE" && project.createdBy !== requesterId) {
    // Check if assigned any tasks in this project
    const { tasksTable } = await import("@workspace/db/schema");
    const { and } = await import("drizzle-orm");
    const tasks = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.projectId, req.params.id as string), eq(tasksTable.assigneeId, requesterId)));
    if (tasks.length === 0) {
      throw createError("Forbidden: You can only edit projects you created or are assigned to", 403);
    }
  }

  const [row] = await db
    .update(projectsTable)
    .set({ ...sanitized, updatedBy: requesterId })
    .where(eq(projectsTable.id, (req.params.id as string)))
    .returning();
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.delete("/:id", requirePermission("projects.delete"), asyncHandler(async (req, res) => {
  await db.delete(projectsTable).where(eq(projectsTable.id, (req.params.id as string)));
  return res.status(204).send();
}));

export default router;
