import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, projectsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate } from "../lib/validation";
import { requirePermission } from "../middleware/auth";

const router = Router();

function sanitizeTask(body: any, isUpdate = false) {
  if (!isUpdate && (!body.title || typeof body.title !== "string" || body.title.trim() === "")) {
    throw createError("Task title is required", 400);
  }
  return sanitizeAndValidate(body, {
    uuids: ["projectId", "assigneeId", "parentId"],
    dates: ["dueDate"],
    enums: {
      status: ["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED"],
      priority: ["LOW", "MEDIUM", "HIGH"],
    },
  });
}

router.get("/", requirePermission("tasks.view"), asyncHandler(async (req, res) => {
  const rows = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      status: tasksTable.status,
      priority: tasksTable.priority,
      projectId: tasksTable.projectId,
      projectName: projectsTable.name,
      assigneeId: tasksTable.assigneeId,
      assigneeName: usersTable.name,
      dueDate: tasksTable.dueDate,
      description: tasksTable.description,
    })
    .from(tasksTable)
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id));
  return res.json(rows);
}));

router.post("/", requirePermission("tasks.create"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeTask(body, false);
  const [row] = await db.insert(tasksTable).values({ ...sanitized, createdBy: (req as any).userId }).returning();
  return res.status(201).json(row);
}));

router.get("/:id", requirePermission("tasks.view"), asyncHandler(async (req, res) => {
  const [row] = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      status: tasksTable.status,
      priority: tasksTable.priority,
      projectId: tasksTable.projectId,
      projectName: projectsTable.name,
      assigneeId: tasksTable.assigneeId,
      assigneeName: usersTable.name,
      dueDate: tasksTable.dueDate,
      description: tasksTable.description,
      createdBy: tasksTable.createdBy,
    })
    .from(tasksTable)
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .where(eq(tasksTable.id, (req.params.id as string)));
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.patch("/:id", requirePermission("tasks.edit"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeTask(body, true);

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, req.params.id as string));
  if (!task) throw createError("Not found", 404);

  const requesterId = (req as any).userId;
  const requesterRole = (req as any).userRole;

  if (requesterRole === "EMPLOYEE" && task.createdBy !== requesterId && task.assigneeId !== requesterId) {
    throw createError("Forbidden: You can only edit tasks you created or are assigned to", 403);
  }

  const [row] = await db
    .update(tasksTable)
    .set({ ...sanitized, updatedBy: requesterId })
    .where(eq(tasksTable.id, (req.params.id as string)))
    .returning();
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.delete("/:id", requirePermission("tasks.delete"), asyncHandler(async (req, res) => {
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, req.params.id as string));
  if (!task) throw createError("Not found", 404);

  const requesterId = (req as any).userId;
  const requesterRole = (req as any).userRole;

  if (requesterRole === "EMPLOYEE" && task.createdBy !== requesterId) {
    throw createError("Forbidden: Employees can only delete tasks they created", 403);
  }

  await db.delete(tasksTable).where(eq(tasksTable.id, (req.params.id as string)));
  return res.status(204).send();
}));

// ─── Subtasks ─────────────────────────────────────────────────

router.get("/:id/subtasks", requirePermission("tasks.view"), asyncHandler(async (req, res) => {
  const result = await db.execute(
    `SELECT t.*, u.name as assignee_name FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.parent_id = $1 ORDER BY t.created_at ASC`,
    [req.params.id]
  );
  return res.json(result.rows ?? result);
}));

export default router;
