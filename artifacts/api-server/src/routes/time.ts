import { Router } from "express";
import { db } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

// POST /api/time/timer — save a completed time entry from the frontend widget
router.post("/timer", asyncHandler(async (req, res) => {
  const { description, projectId, minutes, billable, startedAt, endedAt } =
    req.body as {
      description?: string;
      projectId?: string;
      minutes?: number;
      billable?: boolean;
      startedAt?: string;
      endedAt?: string;
    };

  const userId = (req as any).user?.id ?? null;

  const [row] = await db.execute(`
    INSERT INTO time_entries (id, project_id, user_id, started_at, ended_at, duration_min, note, is_billable)
    VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    projectId ?? null,
    userId,
    startedAt ? new Date(startedAt) : new Date(),
    endedAt ? new Date(endedAt) : new Date(),
    minutes ?? null,
    description ?? null,
    billable ?? true,
  ]);

  return res.status(201).json(row);
}));

// GET /api/time — list entries, optionally filtered
router.get("/", asyncHandler(async (req, res) => {
  const { projectId, userId, from, to } = req.query as Record<string, string>;
  let query = `SELECT * FROM time_entries WHERE 1=1`;
  const params: unknown[] = [];

  if (projectId) { params.push(projectId); query += ` AND project_id = $${params.length}`; }
  if (userId)    { params.push(userId);    query += ` AND user_id = $${params.length}`; }
  if (from)      { params.push(from);      query += ` AND started_at >= $${params.length}`; }
  if (to)        { params.push(to);        query += ` AND started_at <= $${params.length}`; }

  query += ` ORDER BY started_at DESC LIMIT 200`;
  const rows = await db.execute(query, params);
  return res.json(rows.rows ?? rows);
}));

export default router;
