// node tests/opis.test.js — опись вложения ф. 107 из документа
const assert = require("assert");
const { run, spec, U, t, done, writeDocx } = require("./_load")("d01");
t("опись: документ + приложения, два экземпляра, итог", () => {
  const r = run({ channel: "store", proof: "receipt", warranty: "yes", warranty_months: 12, demand: "refund", product: "Телефон", price: 30000 });
  const ps = spec.render(r.a, r.d);
  const op = U.opis(ps, spec.fileName ? spec.fileName(r.a, r.d) : spec.title);
  const tables = op.filter(p => p.table);
  assert.equal(tables.length, 2);
  const rows = tables[0].table.rows;
  assert(rows[1][1].length > 3 && rows.some(x => /чека/.test(x[1])) && rows.some(x => /гарантийного талона/.test(x[1])));
  assert.equal(rows[rows.length - 1][2], String(rows.length - 2));
  assert.equal(tables[0].table.widths.reduce((x, y) => x + y, 0), 9355);
  assert(op.some(p => p.pageBreak) && op.filter(p => p.text === "ОПИСЬ ВЛОЖЕНИЯ").length === 2);
  writeDocx("opis.docx", Object.assign({}, r.a), r.d, op);
});
done();
