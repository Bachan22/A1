import { Router } from "express";
import { db } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";

const router = Router();

// POST /api/client/feedback — store content post feedback/comment
router.post("/feedback", asyncHandler(async (req, res) => {
  const { postId, comment } = req.body as { postId?: string; comment?: string };
  if (!postId || !comment) throw createError("postId and comment are required", 400);

  const userId = (req as any).user?.id ?? null;

  // Store as a comment on the content post's comments JSON column
  // First fetch the post, then append
  const result = await db.execute(
    `SELECT id, comments FROM content_posts WHERE id = $1`,
    [postId]
  );
  const post = (result.rows ?? result)[0] as { id: string; comments: unknown } | undefined;
  if (!post) throw createError("Post not found", 404);

  const existing: Array<{ id: string; userId: string | null; comment: string; createdAt: string }> =
    Array.isArray(post.comments) ? (post.comments as any[]) : [];

  const newComment = {
    id: crypto.randomUUID(),
    userId,
    comment,
    createdAt: new Date().toISOString(),
  };
  const updated = [...existing, newComment];

  await db.execute(
    `UPDATE content_posts SET comments = $1::jsonb WHERE id = $2`,
    [JSON.stringify(updated), postId]
  );

  return res.status(201).json(newComment);
}));

export default router;
