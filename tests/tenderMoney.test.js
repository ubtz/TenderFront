import test from "node:test";
import assert from "node:assert/strict";
import { formatBudgetAmount, parseBudgetAmount } from "../src/pages/Tender/tender.money.js";

test("budget formatting preserves large amounts and decimals", () => {
  for (const [raw, formatted] of [
    ["21000000000", "21'000'000'000"],
    ["21000000000.25", "21'000'000'000.25"],
    ["0", "0"], ["", ""], ["1000.", "1'000."],
  ]) {
    assert.equal(formatBudgetAmount(raw), formatted);
    assert.equal(parseBudgetAmount(formatted), raw);
  }
});

test("pasted budget separators are removed before saving", () => {
  for (const formatted of ["21'000'000'000", "21’000’000’000", "21,000,000,000", "21 000 000 000"]) {
    assert.equal(parseBudgetAmount(formatted), "21000000000");
  }
});
