import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hash, compare } from "bcryptjs";
import { signToken } from "../lib/jwt";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";

const router = Router();

router.post("/auth/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw createError("Email and password are required", 400);

  // --- TEMPORARY DEVELOPMENT-ONLY LOGIN BYPASS FOR TESTING ---
  if (email === "admin@agencyos.com" && password === "Admin@123") {
    let [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        systemRole: usersTable.systemRole,
        allowedModules: usersTable.allowedModules,
        isActive: usersTable.isActive,
        password: usersTable.password,
      })
      .from(usersTable)
      .where(eq(usersTable.email, email));

    const passwordHash = await hash("Admin@123", 12);

    if (!user) {
      const [inserted] = await db
        .insert(usersTable)
        .values({
          name: "Temporary Admin",
          email: "admin@agencyos.com",
          password: passwordHash,
          role: "SUPER_ADMIN",
          systemRole: "SUPER_ADMIN",
          isActive: true,
          allowedModules: JSON.stringify([
            "dashboard", "clients", "leads", "projects", "tasks", 
            "attendance", "leaves", "invoices", "proposals", 
            "quotations", "purchase-orders", "sales", "content", 
            "settings", "users", "reports", "time"
          ]),
        })
        .returning({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          systemRole: usersTable.systemRole,
          allowedModules: usersTable.allowedModules,
          isActive: usersTable.isActive,
          password: usersTable.password,
        });
      user = inserted;
    } else {
      await db
        .update(usersTable)
        .set({
          password: passwordHash,
          role: "SUPER_ADMIN",
          systemRole: "SUPER_ADMIN",
          isActive: true,
          allowedModules: JSON.stringify([
            "dashboard", "clients", "leads", "projects", "tasks", 
            "attendance", "leaves", "invoices", "proposals", 
            "quotations", "purchase-orders", "sales", "content", 
            "settings", "users", "reports", "time"
          ]),
        })
        .where(eq(usersTable.id, user.id));

      user.role = "SUPER_ADMIN";
      user.systemRole = "SUPER_ADMIN";
      user.isActive = true;
      user.allowedModules = JSON.stringify([
        "dashboard", "clients", "leads", "projects", "tasks", 
        "attendance", "leaves", "invoices", "proposals", 
        "quotations", "purchase-orders", "sales", "content", 
        "settings", "users", "reports", "time"
      ]);
    }

    const token = signToken(user.id);
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        systemRole: user.systemRole,
        allowedModules: user.allowedModules ? JSON.parse(user.allowedModules) : [],
      },
    });
  }
  // ------------------------------------------------------------

  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      systemRole: usersTable.systemRole,
      allowedModules: usersTable.allowedModules,
      isActive: usersTable.isActive,
      password: usersTable.password,
    })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user) throw createError("Invalid credentials", 401);

  const valid = await compare(password, user.password || "");
  if (!valid) throw createError("Invalid credentials", 401);

  if (!user.isActive) {
    throw createError(
      "Your account is pending admin approval. Please contact your administrator.",
      403,
    );
  }

  const token = signToken(user.id);
  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      systemRole: user.systemRole,
      allowedModules: user.allowedModules ? JSON.parse(user.allowedModules) : [],
    },
  });
}));

router.post("/auth/register", asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    throw createError("Name, email, and password are required", 400);
  }
  if (password.length < 6) {
    throw createError("Password must be at least 6 characters", 400);
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (existing) throw createError("An account with this email already exists", 409);

  const passwordHash = await hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      email,
      password: passwordHash,
      role: "MANAGER",
      systemRole: "ACCOUNT_MANAGER",
      isActive: false,
    })
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      systemRole: usersTable.systemRole,
    });

  return res.status(201).json({
    message: "Account created successfully. Please wait for admin approval before logging in.",
    user,
  });
}));

export default router;


