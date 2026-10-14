// node tests/d83.test.js — дарение квартиры
const assert = require("assert");
const { spec, run, allErrors, t, done, writeDocx } = require("./_load")("d83");
const base = Object.assign({}, spec.defaults, {
  address: "г. Москва, ул. Ленина, д. 5, кв. 7", rooms: 1, area: 38, cadastral: "77:01:0001001:1234", own_doc: "договор приватизации от 10.03.1995", cad_value: 9000000, city: "г. Москва", doc_date: "2026-10-01",
  dn_name: "Иванова Мария Петровна", dn_birth: "1950-01-01", dn_passport: "45 00 111111", dn_address: "г. Москва",
  de_name: "Иванов Иван Иванович", de_birth: "1975-01-01", de_passport: "45 12 345678", de_address: "г. Москва",
});
t("дарение сыну: без налога, пожизненное проживание, отмена при смерти одаряемого", () => {
  const r = run(base, { stay: "yes", revoke: "yes" });
  assert(r.text.includes("безвозмездно передаёт") && r.text.includes("1-комнатную квартиру") && r.text.includes("пожизненного пользования") && r.text.includes("п. 4 ст. 578"));
  assert(spec.guidance(r.a, r.d).some(g => g.title === "Налога нет."));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d83.docx", r.a, r.d);
});
t("не родственник: НДФЛ от кадастровой стоимости с прогрессией", () => {
  const r = run(base, { relation: "other" });
  assert.equal(r.d.tax, 312000 + Math.round(6600000 * 0.15));
});
done();
