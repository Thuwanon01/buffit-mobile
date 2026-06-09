/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import {
  findCriteriaForLevel,
  calculateCoinsEarned,
  applyCoinDelta,
} from "./scoring";

const criteria = [
  { level: 1, metric: "km", value: 3, unit: "km" },
  { level: 2, metric: "km", value: 5, unit: "km" },
  { level: 3, metric: "km", value: 8, unit: "km" },
];

describe("findCriteriaForLevel", () => {
  test("returns criteria matching user level", () => {
    expect(findCriteriaForLevel(criteria, 2)).toEqual({
      level: 2,
      metric: "km",
      value: 5,
      unit: "km",
    });
  });

  test("falls back to level 1 when no exact match", () => {
    expect(findCriteriaForLevel(criteria, 99)).toEqual({
      level: 1,
      metric: "km",
      value: 3,
      unit: "km",
    });
  });

  test("returns level 1 for level 1 user", () => {
    expect(findCriteriaForLevel(criteria, 1).value).toBe(3);
  });
});

describe("calculateCoinsEarned", () => {
  test("floor division times multiplier (1.0)", () => {
    // 10km / 3km threshold = floor(3.33) = 3 coins
    expect(calculateCoinsEarned(10, 3, 1.0)).toBe(3);
  });

  test("applies weight multiplier > 1", () => {
    // floor(10/3) = 3, × 1.5 = 4.5
    expect(calculateCoinsEarned(10, 3, 1.5)).toBe(4.5);
  });

  test("returns 0 when below minimum criteria", () => {
    // 2km < 3km threshold → floor(2/3) = 0
    expect(calculateCoinsEarned(2, 3, 1.0)).toBe(0);
  });

  test("exact multiple gives exact coin count", () => {
    // 9km / 3km = floor(3) = 3
    expect(calculateCoinsEarned(9, 3, 1.0)).toBe(3);
  });
});

describe("applyCoinDelta", () => {
  test("adds earned coins", () => {
    expect(applyCoinDelta(10, 3)).toBe(13);
  });

  test("subtracts revoked coins", () => {
    expect(applyCoinDelta(10, -3)).toBe(7);
  });

  test("floors at 0 — revoke never produces negative coins", () => {
    expect(applyCoinDelta(2, -5)).toBe(0);
  });

  test("floors at 0 when delta exactly cancels", () => {
    expect(applyCoinDelta(5, -5)).toBe(0);
  });
});
