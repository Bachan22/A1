import { pgTable, text, real, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  number: text("number"),
  clientId: text("client_id").references(() => clientsTable.id, { onDelete: "set null" }), // In a PO, the client might be the vendor
  status: text("status").default("DRAFT"),
  orderDate: text("order_date"),
  deliveryDate: text("delivery_date"),
  companyGstin: text("company_gstin"),
  vendorGstin: text("vendor_gstin"),
  billingAddress: text("billing_address"),
  shippingAddress: text("shipping_address"),
  subtotal: real("subtotal").default(0),
  taxAmount: real("tax_amount").default(0),
  total: real("total").default(0),
  notes: text("notes"),
  termsAndConditions: text("terms_and_conditions"),
  lineItems: json("line_items").$type<Array<{ description: string; hsnSac?: string; qty: number; unitPrice: number; taxPercent: number }>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrdersTable).omit({ id: true, createdAt: true });
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
