import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDaySlots, type DayInput } from "../src/lib/availability";
import { zonedToUtc } from "../src/lib/time";
import { normalizePhone } from "../src/lib/validation";

const TZ = "Europe/Istanbul";
const DAY = "2030-06-04"; // a Tuesday
const at = (t: string) => zonedToUtc(DAY, t, TZ).getTime();

function input(over: Partial<DayInput> = {}): DayInput {
  return {
    dateKey: DAY,
    timezone: TZ,
    branchHours: { is_closed: false, open_time: "09:00", close_time: "18:00" },
    branchClosed: false,
    durationMinutes: 60,
    intervalMinutes: 30,
    earliestStart: 0,
    latestDateKey: "2031-01-01",
    employees: [
      { id: "a", hours: [{ weekday: 2, start_time: "09:00", end_time: "17:00", break_start: "12:00", break_end: "13:00" }], busy: [] },
    ],
    ...over,
  };
}
const free = (d: ReturnType<typeof computeDaySlots>) => d.slots.filter((s) => s.available).map((s) => s.time);

test("slots respect working hours and lunch break", () => {
  const f = free(computeDaySlots(input()));
  assert.equal(f[0], "09:00");
  assert.ok(f.includes("11:00"));
  assert.ok(!f.includes("11:30"), "11:30–12:30 overlaps the break");
  assert.ok(!f.includes("12:00") && !f.includes("12:30"));
  assert.ok(f.includes("13:00"));
  assert.equal(f.at(-1), "16:00", "must finish by end of shift (17:00)");
});

test("existing appointments block overlapping slots only", () => {
  const d = computeDaySlots(input({
    employees: [{ id: "a", hours: [{ weekday: 2, start_time: "09:00", end_time: "17:00", break_start: null, break_end: null }], busy: [{ start: at("10:00"), end: at("11:00") }] }],
  }));
  const f = free(d);
  assert.ok(f.includes("09:00"), "09:00–10:00 touches but does not overlap");
  assert.ok(!f.includes("09:30") && !f.includes("10:00") && !f.includes("10:30"));
  assert.ok(f.includes("11:00"));
  assert.ok(d.slots.some((s) => s.time === "10:00" && !s.available), "unavailable slots are still listed for the UI");
});

test("any professional: slot is free if one of several is free", () => {
  const hours = [{ weekday: 2, start_time: "09:00", end_time: "17:00", break_start: null, break_end: null }];
  const d = computeDaySlots(input({
    employees: [
      { id: "a", hours, busy: [{ start: at("09:00"), end: at("12:00") }] },
      { id: "b", hours, busy: [] },
    ],
  }));
  const s = d.slots.find((x) => x.time === "10:00")!;
  assert.deepEqual(s.employeeIds, ["b"]);
});

test("closed days, holidays, day off and booking horizon yield no slots", () => {
  assert.equal(computeDaySlots(input({ branchHours: { is_closed: true, open_time: null, close_time: null } })).open, false);
  assert.equal(free(computeDaySlots(input({ branchClosed: true }))).length, 0);
  assert.equal(free(computeDaySlots(input({ latestDateKey: "2030-06-01" }))).length, 0);
  const off = input({ employees: [{ id: "a", hours: [{ weekday: 3, start_time: "09:00", end_time: "17:00", break_start: null, break_end: null }], busy: [] }] });
  assert.equal(free(computeDaySlots(off)).length, 0);
});

test("minimum notice hides slots that start too soon", () => {
  const f = free(computeDaySlots(input({ earliestStart: at("14:15") })));
  assert.equal(f[0], "14:30");
});

test("multi-service duration must fit before closing", () => {
  const f = free(computeDaySlots(input({ durationMinutes: 150 })));
  assert.equal(f.at(-1), "14:30");
});

test("employee hours are clipped to branch opening hours", () => {
  const f = free(computeDaySlots(input({
    branchHours: { is_closed: false, open_time: "10:00", close_time: "16:00" },
    employees: [{ id: "a", hours: [{ weekday: 2, start_time: "08:00", end_time: "20:00", break_start: null, break_end: null }], busy: [] }],
  })));
  assert.equal(f[0], "10:00");
  assert.equal(f.at(-1), "15:00");
});

test("phone normalisation", () => {
  assert.equal(normalizePhone("0532 123 45 67", "90"), "+905321234567");
  assert.equal(normalizePhone("+49 (151) 2345-6789", "90"), "+4915123456789");
  assert.equal(normalizePhone("0049 151 23456789", "90"), "+4915123456789");
  assert.equal(normalizePhone("123", "90"), null);
});
