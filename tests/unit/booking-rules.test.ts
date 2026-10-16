import { describe, expect, it } from "vitest";
import { clientActions, parseAmount, paymentSummary, providerActions } from "@/lib/booking-rules";

const now = new Date("2026-10-17T10:00:00Z");
const future = new Date("2026-10-18T10:00:00Z");
const past = new Date("2026-10-16T10:00:00Z");

describe("booking rules", () => {
  it("lets the client cancel only before the start, and answer only a live proposal", () => {
    expect(clientActions({ status: "ACCEPTED", startAt: future }, now)).toEqual(["cancel"]);
    expect(clientActions({ status: "ACCEPTED", startAt: past }, now)).toEqual([]);
    expect(clientActions({ status: "RESCHEDULE_PROPOSED", startAt: future }, now)).toEqual(["acceptProposal", "declineProposal", "cancel"]);
    expect(clientActions({ status: "CANCELLED_BY_PROVIDER", startAt: future }, now)).toEqual([]);
  });

  it("allows one review per completed visit", () => {
    expect(clientActions({ status: "COMPLETED", startAt: past }, now)).toEqual(["review"]);
    expect(clientActions({ status: "COMPLETED", startAt: past, hasReview: true }, now)).toEqual([]);
    expect(clientActions({ status: "NO_SHOW", startAt: past }, now)).toEqual([]);
  });

  it("gives the professional the right tools at the right time", () => {
    expect(providerActions({ status: "PENDING", startAt: future }, now)).toEqual(["respond", "propose"]);
    expect(providerActions({ status: "ACCEPTED", startAt: future }, now)).toEqual(["propose", "cancel"]);
    expect(providerActions({ status: "ACCEPTED", startAt: past }, now)).toEqual(["complete", "noShow"]);
    expect(providerActions({ status: "RESCHEDULE_PROPOSED", startAt: future }, now)).toEqual(["cancel"]);
    expect(providerActions({ status: "COMPLETED", startAt: past }, now)).toEqual(["pay"]);
    expect(providerActions({ status: "EXPIRED", startAt: future }, now)).toEqual([]);
  });

  it("sums payments and refunds", () => {
    expect(paymentSummary([])).toMatchObject({ net: 0, status: "UNPAID" });
    expect(paymentSummary([{ amount: 3000, status: "PAID" }])).toMatchObject({ net: 3000, status: "PAID" });
    expect(paymentSummary([{ amount: 3000, status: "PAID" }, { amount: 3000, status: "REFUNDED" }])).toMatchObject({ net: 0, status: "REFUNDED" });
    expect(paymentSummary([{ amount: 3000, status: "PAID" }, { amount: 500, status: "REFUNDED" }])).toMatchObject({ net: 2500, status: "PAID" });
  });

  it("parses amounts strictly", () => {
    expect(parseAmount("2 500")).toBe(2500);
    expect(parseAmount("2500,50")).toBe(2500.5);
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("1e5")).toBeNull();
    expect(parseAmount("12.345")).toBeNull();
  });
});
