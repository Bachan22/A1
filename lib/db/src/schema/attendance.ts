import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attendanceTable = pgTable("attendance", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  checkInAt: timestamp("check_in_at").notNull().defaultNow(),
  checkOutAt: timestamp("check_out_at"),
  isLate: boolean("is_late").notNull().default(false),
  overtimeMin: integer("overtime_min").notNull().default(0),
  date: text("date").notNull(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
