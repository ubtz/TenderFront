import assert from "node:assert/strict";
import { test } from "node:test";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import { buildPlanPrintDocument, execTeamFormValues, execTeamPayload } from "../src/pages/Бүртгэл/printDocument.js";

pdfMake.addVirtualFileSystem(pdfFonts.vfs || pdfFonts);

const item = { cr4name: "Бараа", crmarkname: "Марк", usize: "100x200", zno: "DRAW-1", mname: "ш", qty: 2, price: 150, dname: "НХ" };
const basket = { basket_number: 1, basket_name: "Багц", items: [item], publish_date: "2026-09-07" };
const plan = { plan_name: "Төлөвлөгөө", baskets: [basket] };
const getTable = (document) => document.content.find((entry) => entry.table).table;

test("print headers and item rows all have 14 columns without the hidden tender columns", () => {
  const table = getTable(buildPlanPrintDocument(plan));
  assert.equal(table.widths.length, 14);
  assert.ok(table.body.every((row) => row.length === 14));
  assert.equal(table.body[0][0].text, "Багц");
  assert.equal(table.body[2][4].text, "100x200");
  assert.equal(table.body[2][5].text, "DRAW-1");
  assert.equal(table.body[2][6].text, "ш");
  assert.equal(table.body[2][9].text, "300");
});

test("equal basket names and numbers stay separate in the PDF", () => {
  const table = getTable(buildPlanPrintDocument({ baskets: [
    { ...basket, items: [item, item] },
    { ...basket, items: [item, item] },
  ] }));
  assert.equal(table.body[2][0].rowSpan, 2);
  assert.equal(table.body[4][0].rowSpan, 2);
  assert.equal(table.body[2][11].rowSpan, 4);
  assert.equal(table.body[2][11].text, "1,200");
});

test("saved approval details survive the read-only print path", () => {
  const values = execTeamFormValues({
    Батлах: "Дарга: Бат",
    Зөвшөөрсөн: "Инженер: Болд",
    Гүйцэтгэсэн: "Мэргэжилтэн: Дорж",
  });
  const payload = execTeamPayload(values, 42, "7");
  assert.equal(payload.planRootNumber, "42");
  assert.equal(payload.userId, 7);
  assert.equal(payload.batlah, "Дарга: Бат");
  assert.equal(payload.zuvshuursun, "Инженер: Болд");
  assert.equal(payload.guitsetgesen, "Мэргэжилтэн: Дорж");
  const documentText = JSON.stringify(buildPlanPrintDocument(plan, payload));
  for (const name of ["Бат", "Болд", "Дорж"]) assert.ok(documentText.includes(name));
});

test("missing approval details produce empty text instead of undefined PDF nodes", () => {
  const payload = execTeamPayload(execTeamFormValues(null), "42", 7);
  assert.equal(payload.batlah, "");
  assert.equal(payload.zuvshuursun, "");
  assert.equal(payload.guitsetgesen, "");
  assert.throws(() => buildPlanPrintDocument(null), /Төлөвлөгөө/);
});

for (const [name, data] of [
  ["populated plan", plan],
  ["empty plan", { plan_name: "Хоосон", baskets: [] }],
  ["multi-page plan", { ...plan, baskets: [{ ...basket, items: Array.from({ length: 80 }, () => ({ ...item })) }] }],
]) {
  test(`pdfmake generates a real PDF for a ${name}`, async () => {
    const buffer = await new Promise((resolve) => pdfMake.createPdf(buildPlanPrintDocument(data)).getBuffer(resolve));
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
    assert.ok(buffer.length > 1000);
  });
}
