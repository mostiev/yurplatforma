// node tests/d28.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d28");
const base = {
  docs: ["contract", "payslips", "stdr"], period_from: "с января по август 2026 года", how: "email", submit_date: "2026-10-01",
  org_name: "ООО «Ромашка»", head_position: "Генеральный директор", head_name: "Иванов Иван Иванович", position: "Менеджер", status: "dismissed",
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00", buyer_email: "p@example.com",
};

t("ст. 62: три рабочих дня, безвозмездно, заверенные копии; список документов и период", () => {
  const r = run(base, {});
  assert(r.text.includes("ст. 62") && r.text.includes("трёх рабочих дней") && r.text.includes("безвозмездно") && r.text.includes("заверить"));
  assert(r.text.includes("1. Копия трудового договора") && r.text.includes("3. Сведения о трудовой деятельности") && r.text.includes("с января по август 2026"));
  assert(r.text.includes("Бывшая должность: Менеджер") && r.text.includes("p@example.com"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d28.docx", r.a, r.d);
});

t("срок: 01.10.2026 (чт) + 3 рабочих дня = 06.10.2026 (вт)", () => {
  const { U } = require("./_load")("d28");
  assert.equal(U.fmtDate(run(base, {}).d.due), "06.10.2026");
});

t("период спрашивается только для справок и расчётных листков", () => {
  assert.equal(run(base, { docs: ["contract"] }).a.period_from, undefined);
});

done();
