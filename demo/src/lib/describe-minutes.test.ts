import { expect, test } from "bun:test";
import { describeMinutes } from "./describe-minutes";

test("1 minute", () => {
  expect(describeMinutes(1)).toBe("1 minute");
});

test("multiple minutes", () => {
  expect(describeMinutes(5)).toBe("5 minutes");
  expect(describeMinutes(15)).toBe("15 minutes");
  expect(describeMinutes(45)).toBe("45 minutes");
  expect(describeMinutes(95)).toBe("95 minutes");
});

test("1 hour", () => {
  expect(describeMinutes(60)).toBe("1 hour");
});

test("multiple hours", () => {
  expect(describeMinutes(120)).toBe("2 hours");
  expect(describeMinutes(180)).toBe("3 hours");
  expect(describeMinutes(720)).toBe("12 hours");
});

test("1 day", () => {
  expect(describeMinutes(1440)).toBe("1 day");
});

test("multiple days", () => {
  expect(describeMinutes(2880)).toBe("2 days");
  expect(describeMinutes(10080)).toBe("7 days");
  expect(describeMinutes(43200)).toBe("30 days");
});

test("prefers days over hours when evenly divisible", () => {
  expect(describeMinutes(1440)).toBe("1 day");
  expect(describeMinutes(2880)).toBe("2 days");
});

test("prefers hours over minutes when evenly divisible", () => {
  expect(describeMinutes(60)).toBe("1 hour");
  expect(describeMinutes(120)).toBe("2 hours");
});

test("falls back to minutes when not evenly divisible", () => {
  expect(describeMinutes(90)).toBe("90 minutes");
  expect(describeMinutes(100)).toBe("100 minutes");
  expect(describeMinutes(1501)).toBe("1501 minutes");
});
