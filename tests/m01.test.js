// node tests/m01.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("m01");
const base = {
  reason: "legal", basis: "patent", basis_doc: "патент серии 77 № 2600123456, выдан ГУ МВД России по г. Москве 15.09.2026", basis_date: "2026-09-15",
  checked_date: "2026-09-20", checked_how: "bank", harm: ["bank", "work"],
  buyer_name: "Каримов Азиз Рустамович", citizenship: "Республика Узбекистан", birth_date: "1995-03-12", passport: "FA 1234567, выдан 01.02.2022",
  entry_date: "2026-07-10", buyer_address: "г. Москва, ул. Ленина, д. 5, кв. 7", buyer_phone: "+7 900 000-00-00",
  authority: "Управление по вопросам миграции ГУ МВД России по г. Москве",
};

t("законное основание — патент: подп. 2 п. 7 ст. 31.2, п. 8 Положения, чеки НДФЛ", () => {
  const r = run(base, {});
  assert(!r.stop);
  assert(r.text.includes("С 15.09.2026 у меня имеется законное основание") && r.text.includes("патент на осуществление трудовой деятельности — патент серии 77"));
  assert(r.text.includes("подпунктом 2 пункта 7 статьи 31.2") && r.text.includes("от 26.12.2024 № 1899"));
  assert(r.text.includes("после того как банк заблокировал мою карту") && r.text.includes("банки заблокировали мои счета") && r.text.includes("не могу продолжать работу"));
  assert(r.text.includes("фиксированного авансового платежа") && r.text.includes("статьёй 12 Федерального закона № 59-ФЗ"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("m01.docx", r.a, r.d);
});

t("ошибка: перечень п. 2 исчерпывающий, просьба исправить учёты", () => {
  const r = run(base, { reason: "error", error_text: "въехал 10.07.2026, срок пребывания до 07.10.2026, в реестр внесён 20.09.2026." });
  assert(r.text.includes("включены в реестр ошибочно: въехал 10.07.2026") && !r.text.includes("20.09.2026..") && r.text.includes("исчерпывающий перечень"));
  assert(r.text.includes("внести исправления в учёты") && !r.text.includes("патент"));
  assert.equal(r.a.basis, undefined);
});

t("отмена решения: судом — подп. 4, органом — подп. 3", () => {
  const c = run(base, { reason: "cancelled", decision: "решение о сокращении срока временного пребывания от 01.08.2026", cancelled_by: "court", decision_act: "решение Тверского районного суда г. Москвы от 15.09.2026 по делу № 2а-1234/2026" });
  assert(c.text.includes("подпунктом 4 пункта 7") && c.text.includes("признано судом незаконным") && c.text.includes("отметкой о вступлении в законную силу"));
  assert(run(base, { reason: "cancelled", decision: "решение", cancelled_by: "authority", decision_act: "решение от 01.09.2026" }).text.includes("подпунктом 3 пункта 7"));
});

t("выезд — подп. 1; «просто хочу выйти» — стоп", () => {
  const r = run(base, { reason: "left", exit_date: "2026-08-01", back_date: "2026-08-20" });
  assert(r.text.includes("выехал(а) из Российской Федерации 01.08.2026 и въехал(а) вновь 20.08.2026") && r.text.includes("подпунктом 1 пункта 7"));
  assert(run(base, { reason: "none" }).stop.title.includes("Без основания"));
});

done();
