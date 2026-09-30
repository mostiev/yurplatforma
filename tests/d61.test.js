// node tests/d61.test.js
const assert = require("assert");
const { run, spec, U, allErrors, t, done, writeDocx } = require("./_load")("d61");
const iso = d => U.iso(d);
const ago = m => iso(U.addMonths(U.today(), -m));
const base = Object.assign({}, spec.defaults, {
  relation: "child", d_name: "Иванов Пётр Сергеевич", d_birth: "1950-04-01", death_date: ago(2), d_address: "г. Москва, ул. Ленина, д. 5, кв. 7",
  buyer_name: "Иванова Мария Петровна", gender: "f", buyer_birth: "1980-01-01", passport: "45 12 345678, выдан 01.02.2020", buyer_address: "г. Москва, ул. Мира, д. 1", buyer_phone: "+7 900 000-00-00",
  app_date: iso(U.today()),
});

t("принятие по закону: дочь, имущество списком, свидетельство", () => {
  const r = run(base, { property: "квартира по адресу г. Москва, ул. Ленина, д. 5, кв. 7\nденежные вклады в ПАО Сбербанк.", notary: "Нотариус г. Москвы Иванова А. П." });
  assert(r.text.includes("о принятии наследства и выдаче свидетельства о праве на наследство"));
  assert(r.text.includes("умер Иванов Пётр Сергеевич, 01.04.1950 г. р., последнее место жительства: г. Москва, ул. Ленина, д. 5, кв. 7."));
  assert(r.text.includes("Я являюсь наследником первой очереди по закону: дочь наследодателя."));
  assert(r.text.includes("принимаю наследство, оставшееся после его смерти, по закону, в чём бы оно ни заключалось"));
  assert(r.text.includes("кв. 7;\n") && r.text.includes("в ПАО Сбербанк.\n") && r.text.includes("Иные наследники мне не известны."));
  assert(!r.stop && !r.text.includes("засвидетельствованию"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d61.docx", r.a, r.d);
});

t("внучка по представлению; супруга — выдел доли; почтой", () => {
  const g = run(base, { relation: "grandchild", repr_name: "Иванов Андрей Петрович", repr_death: "2020-01-01", d_gender: "f" });
  assert(g.text.includes("внучка наследодателя, наследую по праву представления вместо моего родителя — Иванов Андрей Петрович, дата смерти 01.01.2020") && g.text.includes("умерла") && g.text.includes("после её смерти"));
  const s = run(base, { relation: "spouse", spouse_share: "yes", delivery: "mail" });
  assert(s.text.includes("супруга наследодателя") && s.text.includes("ст. 75 Основ") && s.text.includes("подлежит засвидетельствованию нотариусом"));
});

t("отказ в пользу и без указания лиц", () => {
  const r = run(base, { kind: "refuse_for", for_name: "Иванов Сергей Петрович", for_rel: "сын наследодателя" });
  assert(r.text.includes("об отказе от наследства") && r.text.includes("в пользу наследника — Иванов Сергей Петрович (сын наследодателя) в соответствии со ст. 1158"));
  assert(r.text.includes("п. 3 ст. 1157") && !r.text.includes("Приложения"));
  assert(spec.guidance(r.a, r.d).some(x => x.text.includes("обязательной доли")));
  assert(run(base, { kind: "refuse" }).text.includes("без указания лиц"));
});

t("срок: истёк — стоп; при отказе другого наследника — нет", () => {
  assert(run(base, { death_date: ago(8) }).stop.text.includes("ст. 1155"));
  assert(run(base, { death_date: ago(8), kind: "refuse" }).stop.title.includes("отказа"));
  assert(!run(base, { death_date: ago(8), late_right: "yes" }).stop);
  const ok = run(base, {});
  assert(spec.guidance(ok.a, ok.d)[0].title.includes(U.fmtDate(ok.d.deadline)));
});

t("по завещанию", () => {
  const r = run(base, { basis: "will", will_info: "от 12.05.2021, удостоверено нотариусом г. Москвы Петровой И. И." });
  assert(r.text.includes("Я являюсь наследником по завещанию от 12.05.2021") && r.text.includes("по завещанию, в чём бы"));
});

done();
