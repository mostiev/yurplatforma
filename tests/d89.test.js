// node tests/d89.test.js
const assert = require("assert");
const { run, spec, U, allErrors, t, done, writeDocx } = require("./_load")("d89");
const iso = d => U.iso(d);
const ago = m => iso(U.addMonths(U.today(), -m));
const base = Object.assign({}, spec.defaults, {
  p_name: "Петров Сергей Иванович", p_birth: "1990-01-01", p_address: "г. Уфа, ул. Ленина, д. 5", unit: "войсковая часть 12345", enlist: "военный комиссариат Ленинского района г. Уфы",
  last_news: ago(8), circumstances: "По сведениям командира, после боя не вернулся на место сбора", court: "Ленинский районный суд г. Уфы",
  buyer_name: "Петрова Анна Петровна", relation: "супруга", buyer_address: "г. Уфа, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00", doc_date: iso(U.today()),
});

t("безвестно отсутствующий: ст. 23, 6 месяцев, цель, без справки — истребовать", () => {
  const r = run(base);
  assert(r.text.includes("о признании гражданина безвестно отсутствующим") && r.text.includes("статья 23 Федерального закона от 30.11.1994 № 52-ФЗ"));
  assert(r.text.includes("Я являюсь членом его семьи: супруга.") && r.text.includes("призван на военную службу по мобилизации и принимал участие"));
  assert(r.text.includes("назначения пенсии по случаю потери кормильца") && r.text.includes("Прошу истребовать сведения") && r.text.includes("Государственная пошлина: 3 000 ₽"));
  assert(r.text.includes("признать гражданина Петров Сергей Иванович, 01.01.1990 г. р., безвестно отсутствующим"));
  assert(run(base, { p_name_acc: "Петрова Сергея Ивановича" }).text.includes("признать Петрова Сергея Ивановича, 01.01.1990"));
  assert(!r.stop); assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨") && !r.text.includes(".."));
  writeDocx("d89.docx", r.a, r.d);
});

t("объявить умершим: бой, день предполагаемой гибели, справка, свидетели", () => {
  const r = run(base, { kind: "dead", dead_basis: "danger", event_date: ago(7), cert: "death", cert_info: "№ 123 от 01.09.2026", purpose: ["pay", "inherit"], witnesses: [{ name: "Иванов И. И.", address: "+7 900 111-11-11" }] });
  assert(r.text.includes("об объявлении гражданина умершим") && r.text.includes("пункт 2 статьи 24") && r.text.includes("день предполагаемой гибели"));
  assert(r.text.includes("справкой об обстоятельствах исчезновения или возможной гибели") && r.text.includes("допросить свидетелей: Иванов И. И. (+7 900 111-11-11)"));
  assert(r.text.includes("получения страховых сумм") && r.text.includes("оформления наследственных прав"));
  assert(!r.stop); assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d89-dead.docx", r.a, r.d);
});

t("сроки: рано — мягко с датой и напоминанием; после признания — 3 месяца; выплаты — только при объявлении умершим", () => {
  const e = run(base, { last_news: ago(2) });
  assert(e.stop.soft && e.stop.title.includes(U.fmtDate(U.addMonths(U.date(ago(2)), 6))) && spec.reminders(e.a, e.d).length === 1);
  const a3 = run(base, { kind: "dead", dead_basis: "absent", absent_date: ago(4) });
  assert(!a3.stop && a3.text.includes("пункт 4 статьи 24"));
  assert(run(base, { kind: "dead", dead_basis: "absent", absent_date: ago(1) }).stop.soft);
  assert(!run(base, { purpose: ["pay", "pension"] }).text.includes("страховых сумм"));
  assert(run(base, { p_gender: "f" }).text.includes("призвана на военную службу") );
});

done();
