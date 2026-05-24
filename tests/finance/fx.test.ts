import { describe, it, expect } from "vitest";
import { toEur, fromEur, combineRates } from "@/lib/finance/fx";

describe("fx", () => {
  it("converts USD to EUR using the supplied rate", () => {
    expect(toEur(100, 0.92)).toBeCloseTo(92, 6);
  });

  it("converts EUR back to a target currency", () => {
    expect(fromEur(92, 1 / 0.92)).toBeCloseTo(100, 4);
  });

  it("combines two rates", () => {
    expect(combineRates(0.92, 1.08)).toBeCloseTo(0.9936, 4);
  });
});
