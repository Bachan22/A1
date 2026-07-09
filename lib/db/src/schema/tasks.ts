import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const tasksTable = pgTable("tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  status: text("status").default("TODO"),
  priority: text("priority").default("MEDIUM"),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  assigneeId: text("assignee_id").references(() => usersTable.id, { onDelete: "set null" }),
  dueDate: timestamp("due_date"),
  description: text("description"),
  parentId: text("parent_id").references((): any => tasksTable.id, { onDelete: "cascade" }),
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  deletedAt: timestamp("deleted_at"),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
