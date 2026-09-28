// node tests/d25.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d25");
const base = {
  submit_date: "2026-10-01", mode: "standard", last_day: "2026-10-15",
  org_name: "ООО «Ромашка»", head_position: "Генеральный директор", head_name: "Иванов Иван Иванович",
  buyer_name: "Петров Пётр Петрович", position: "Менеджер по продажам", book: "electronic", vacation: "yes",
};

t("стандарт: 14 дней, п. 3 ч. 1 ст. 77, расчёт по ст. 140, компенсация за отпуск по ст. 127, СТД-Р", () => {
  const r = run(base, {});
  assert(r.text.includes("п. 3 ч. 1 ст. 77") && r.text.includes("ст. 140") && r.text.includes("ст. 127") && r.text.includes("СТД-Р"));
  assert(r.text.startsWith("Кому: Генеральный директор ООО «Ромашка»") && r.text.includes("Должность: Менеджер по продажам"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d25.docx", r.a, r.d);
});

t("с отработкой нельзя раньше 14 дней; по соглашению — можно", () => {
  assert(allErrors(run(base, { last_day: "2026-10-10" }).a).includes("last_day"));
  const r = run(base, { mode: "agreement", last_day: "2026-10-05" });
  assert.deepEqual(allErrors(r.a), []); assert(r.text.includes("ч. 2 ст. 80"));
});

t("невозможность продолжения работы — ч. 3 ст. 80 и причина", () => {
  const r = run(base, { mode: "impossible", reason: "violation", reason_desc: "задержка зарплаты", last_day: "2026-10-02" });
  assert(r.text.includes("ч. 3 ст. 80") && r.text.includes("установленным нарушением работодателем") && r.text.includes("задержка зарплаты"));
});

t("бумажная трудовая — просим трудовую книжку; нет отпуска — без ст. 127", () => {
  const r = run(base, { book: "paper", vacation: "no" });
  assert(r.text.includes("выдать трудовую книжку") && !r.text.includes("ст. 127"));
});

done();
