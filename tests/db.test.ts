/**
 * Database-level guarantees. Runs only when TEST_DATABASE_URL points at a
 * migrated + seeded database (never run against production).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

const url = process.env.TEST_DATABASE_URL;

test("exclusion constraint rejects overlapping appointments for one professional", { skip: !url && "TEST_DATABASE_URL not set" }, async () => {
  const sql = postgres(url!, { prepare: false, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      const [ctx] = await tx`select e.id as employee_id, e.branch_id, e.salon_id from employees e limit 1`;
      const [c] = await tx`insert into customers (salon_id, first_name, last_name, phone) values (${ctx.salon_id}, 'T', 'T', '+900000000001') returning id`;
      const base = { salon_id: ctx.salon_id, branch_id: ctx.branch_id, employee_id: ctx.employee_id, customer_id: c.id, total_price_cents: 0, total_duration_minutes: 60 };
      await tx`insert into appointments ${tx({ ...base, reference: "TEST-1", starts_at: new Date("2035-01-01T10:00:00Z"), ends_at: new Date("2035-01-01T11:00:00Z") })}`;
      // Back-to-back is fine
      await tx`insert into appointments ${tx({ ...base, reference: "TEST-2", starts_at: new Date("2035-01-01T11:00:00Z"), ends_at: new Date("2035-01-01T12:00:00Z") })}`;
      // Overlap must fail
      await tx`savepoint s`;
      await assert.rejects(
        tx`insert into appointments ${tx({ ...base, reference: "TEST-3", starts_at: new Date("2035-01-01T10:30:00Z"), ends_at: new Date("2035-01-01T11:30:00Z") })}`,
        (e: { code?: string }) => e.code === "23P01",
      );
      await tx`rollback to savepoint s`;
      // A cancelled appointment frees the slot
      await tx`update appointments set status = 'cancelled' where reference = 'TEST-1'`;
      await tx`insert into appointments ${tx({ ...base, reference: "TEST-4", starts_at: new Date("2035-01-01T10:00:00Z"), ends_at: new Date("2035-01-01T11:00:00Z") })}`;
      throw new Error("rollback");
    }).catch((e) => {
      if (e.message !== "rollback") throw e;
    });
  } finally {
    await sql.end();
  }
});
