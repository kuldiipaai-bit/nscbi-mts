import { describe, expect, it } from "vitest";
import { fmtDateShort, summarize, type ReportActivity } from "./report";

const act = (over: Partial<ReportActivity>): ReportActivity => ({
  id: Math.random().toString(36).slice(2),
  title: "t",
  activity_date: "2026-11-14",
  start_time: "09:00:00",
  end_time: "10:00:00",
  priority: "medium",
  services: { name: "Lifts" },
  observations: [],
  ...over,
});

describe("report summary", () => {
  it("is all zeros for an empty period", () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.percent).toBe(0);
    expect(s.byService).toEqual([]);
  });

  it("counts monitored, open, resolved and per-service totals", () => {
    const rows = [
      act({ services: { name: "Lifts" }, observations: [{ id: "1", status: "open" }] }),
      act({ services: { name: "Lifts" } }),
      act({ services: { name: "HVAC" }, observations: [{ id: "2", status: "resolved" }, { id: "3", status: "open" }] }),
      act({ services: null }),
    ];
    const s = summarize(rows);
    expect(s.total).toBe(4);
    expect(s.monitored).toBe(2);
    expect(s.notMonitored).toBe(2);
    expect(s.percent).toBe(50);
    expect(s.open).toBe(2);
    expect(s.resolved).toBe(1);
    expect(s.byService.map((r) => r.name)).toEqual(["HVAC", "Lifts", "No service"]);
    const lifts = s.byService.find((r) => r.name === "Lifts")!;
    expect([lifts.total, lifts.monitored, lifts.notMonitored, lifts.open]).toEqual([2, 1, 1, 1]);
  });

  it("lists only unmonitored critical work, earliest first, and counts critical with open issues", () => {
    const rows = [
      act({ priority: "critical", activity_date: "2026-11-15", start_time: "08:00:00" }),
      act({ priority: "critical", activity_date: "2026-11-14", start_time: "14:00:00" }),
      act({ priority: "critical", observations: [{ id: "9", status: "open" }] }),
      act({ priority: "high" }),
    ];
    const s = summarize(rows);
    expect(s.unmonitoredCritical.map((r) => r.activity_date + r.start_time)).toEqual(["2026-11-1414:00:00", "2026-11-1508:00:00"]);
    expect(s.criticalWithOpen).toBe(1);
  });

  it("formats dates in the report style", () => {
    expect(fmtDateShort("2026-11-04")).toBe("04 Nov 2026");
  });
});
