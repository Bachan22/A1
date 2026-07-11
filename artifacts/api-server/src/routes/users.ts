import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate } from "../lib/validation";

const router = Router();

function sanitizeUser(body: any, isUpdate = false) {
  return sanitizeAndValidate(body, {
    enums: {
      systemRole: ["SUPER_ADMIN", "ACCOUNT_MANAGER", "CREATIVE_STRATEGIST", "DESIGNER", "DEVELOPER", "CONTENT_CREATOR", "CLIENT"],
    }
  });
}

const USER_SAFE_COLS = {
  id: usersTable.id,
  name: usersTable.name,
  email: usersTable.email,
  role: usersTable.role,
  systemRole: usersTable.systemRole,
  department: usersTable.department,
  isActive: usersTable.isActive,
  allowedModules: usersTable.allowedModules,
};

function parseModules(row: { allowedModules: string | null }) {
  return { ...row, allowedModules: row.allowedModules ? JSON.parse(row.allowedModules) : [] };
}

const requireAdmin = asyncHandler(async (req: any, res: any, next: any) => {
  const userId = req.userId;
  if (!userId) throw createError("Unauthorized", 401);
  const [user] = await db
    .select({ systemRole: usersTable.systemRole })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user || user.systemRole !== "SUPER_ADMIN") {
    throw createError("Forbidden: Admin access required", 403);
  }
  next();
});

router.get("/", asyncHandler(async (req, res) => {
  const rows = await db.select(USER_SAFE_COLS).from(usersTable);
  return res.json(rows.map(parseModules));
}));

router.post("/", requireAdmin, asyncHandler(async (req, res) => {
  const { name, email, password, systemRole, department, isActive, allowedModules } = req.body;
  if (!name || !email) throw createError("Name and email are required", 400);

  const sanitized = sanitizeUser({ systemRole, department, isActive }, false);

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (existing) throw createError("User with this email already exists", 409);

  const passwordHash = password ? await hash(password, 12) : null;

  const [row] = await db
    .insert(usersTable)
    .values({
      name,
      email,
      password: passwordHash,
      systemRole: sanitized.systemRole || "ACCOUNT_MANAGER",
      role: sanitized.systemRole || "ACCOUNT_MANAGER",
      department: sanitized.department || null,
      isActive: sanitized.isActive !== undefined ? sanitized.isActive : true,
      allowedModules: allowedModules ? JSON.stringify(allowedModules) : JSON.stringify([]),
    })
    .returning(USER_SAFE_COLS);

  return res.status(201).json(parseModules(row));
}));

router.patch("/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, password: _pw, ...body } = req.body;

  if (body.email) {
    const [conflict] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, body.email));
    if (conflict && conflict.id !== (req.params.id as string)) {
      throw createError("Email is already in use by another account", 409);
    }
  }

  const sanitized = sanitizeUser(body, true);
  const updateData: Record<string, unknown> = { ...sanitized };
  if (sanitized.systemRole) updateData.role = sanitized.systemRole;
  if (body.allowedModules) updateData.allowedModules = JSON.stringify(body.allowedModules);

  const [row] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, (req.params.id as string)))
    .returning(USER_SAFE_COLS);

  if (!row) throw createError("User not found", 404);
  return res.json(parseModules(row));
}));

router.delete("/:id", requireAdmin, asyncHandler(async (req, res) => {
  await db.delete(usersTable).where(eq(usersTable.id, (req.params.id as string)));
  return res.status(204).send();
}));

export default router;
