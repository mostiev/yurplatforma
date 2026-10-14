// node tests/d80.test.js — доверенность от организации
const assert = require("assert");
const { U, spec, run, allErrors, t, done, writeDocx } = require("./_load")("d80");
const base = Object.assign({}, spec.defaults, {
  powers: ["court", "contracts"], city: "г. Москва", doc_date: "2026-10-01",
  pr_name: "ООО «Ромашка»", pr_inn: "7701234567", pr_address: "г. Москва", pr_head_pos: "Генеральный директор", pr_head: "Петров Пётр Петрович",
  ag_name: "Сидоров Сидор Сидорович", ag_passport: "45 12 345678",
});
t("суд со специальными полномочиями ст. 62 АПК, срок — год по умолчанию", () => {
  const r = run(base, {});
  assert(r.text.includes("отказываться от исковых требований") && r.text.includes("ст. 62 АПК") && r.text.includes("без права передоверия") && r.text.includes("до 30.09.2027"));
  assert(spec.guidance(r.a, r.d)[0].title.includes("юрист"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text.match(/⟨[^⟩]*⟩/g));
  writeDocx("d80.docx", r.a, r.d);
});
t("ИП и налоговая — предупреждение о нотариусе или МЧД; передоверие", () => {
  const r = run(base, { pr_kind: "ip", pr_name: "Иванов Иван Иванович", pr_inn: "771234567890", powers: ["tax"], sub: "yes" });
  assert(r.text.includes("с правом передоверия") && spec.guidance(r.a, r.d).some(g => g.title.includes("От ИП")));
});
done();
