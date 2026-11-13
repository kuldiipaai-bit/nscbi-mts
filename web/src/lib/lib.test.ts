import { describe, expect, it } from "vitest";
import { activityState, activityWindow, addDays, crossesMidnight, visibleOnDay } from "./time";
import { normalizeRows, parseChecklist, parseDateCell, parseTimeCell } from "./excel";
import type { Service } from "./types";

const act = (date: string, start: string, end: string) => ({ activity_date: date, start_time: start, end_time: end });

describe("time logic", () => {
  it("detects midnight crossing", () => {
    expect(crossesMidnight("22:00:00", "02:00:00")).toBe(true);
    expect(crossesMidnight("06:00:00", "10:00:00")).toBe(false);
  });

  it("computes running/upcoming/past in local time", () => {
    const a = act("2026-11-13", "09:00:00", "15:00:00");
    expect(activityState(a, new Date(2026, 10, 13, 8, 59))).toBe("upcoming");
    expect(activityState(a, new Date(2026, 10, 13, 9, 0))).toBe("running");
    expect(activityState(a, new Date(2026, 10, 13, 14, 59))).toBe("running");
    expect(activityState(a, new Date(2026, 10, 13, 15, 0))).toBe("past");
  });

  it("handles overnight windows", () => {
    const a = act("2026-11-13", "22:00:00", "02:00:00");
    const w = activityWindow(a);
    expect(w.end.getDate()).toBe(14);
    expect(activityState(a, new Date(2026, 10, 14, 1, 0))).toBe("running");
    expect(activityState(a, new Date(2026, 10, 14, 2, 0))).toBe("past");
  });

  it("shows yesterday's overnight activity on the next day, sorted by start", () => {
    const list = [
      act("2026-11-14", "08:00:00", "10:00:00"),
      act("2026-11-13", "22:00:00", "02:00:00"), // spills into the 14th
      act("2026-11-13", "09:00:00", "11:00:00"), // does not
    ];
    const out = visibleOnDay(list, "2026-11-14");
    expect(out).toHaveLength(2);
    expect(out[0].start_time).toBe("22:00:00");
  });

  it("adds days across month ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("spreadsheet import", () => {
  const services = [{ id: "s1", name: "HVAC - Chillers", location: "Plant", owner_me_id: "m", active: true }] as Service[];

  it("parses dates and times in common formats", () => {
    expect(parseDateCell("2026-11-20")).toBe("2026-11-20");
    expect(parseDateCell("20/11/2026")).toBe("2026-11-20");
    expect(parseDateCell("31/02/2026")).toBeNull();
    expect(parseTimeCell("6:05")).toBe("06:05");
    expect(parseTimeCell("0605")).toBe("06:05");
    expect(parseTimeCell("6:05 PM")).toBe("18:05");
    expect(parseTimeCell(0.25)).toBe("06:00");
    expect(parseTimeCell("25:00")).toBeNull();
  });

  it("converts Excel serial numbers correctly", () => {
    expect(parseDateCell(45292)).toBe("2024-01-01");
  });

  it("splits checklist items", () => {
    expect(parseChecklist("a; b |c\nd")).toEqual(["a", "b", "c", "d"]);
  });

  it("validates rows and reports spreadsheet row numbers", () => {
    const { ok, errors } = normalizeRows(
      [
        { Service: "hvac - chillers", Title: "PM", Date: "2026-11-20", "Start Time": "06:00", "End Time": "10:00", Priority: "HIGH" },
        { service: "Nope", title: "x", date: "2026-11-20", start_time: "06:00", end_time: "07:00" },
        { service: "HVAC - Chillers", title: "", date: "bad", start_time: "6", end_time: "7" },
        {},
      ],
      services,
    );
    expect(ok).toHaveLength(1);
    expect(ok[0].priority).toBe("high");
    expect(ok[0].location).toBe("Plant");
    expect(errors.map((e) => e.row)).toEqual([3, 4]);
    expect(errors[1].message).toContain("title is required");
  });
});
