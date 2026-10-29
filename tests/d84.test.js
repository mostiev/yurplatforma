// node tests/d84.test.js
const assert = require("assert");
const { run, spec, U, allErrors, t, done, writeDocx } = require("./_load")("d84");
const iso = d => U.iso(d);
const ago = m => iso(U.addMonths(U.today(), -m));
const base = Object.assign({}, spec.defaults, {
  d_name: "Иванов Пётр Сергеевич", death_date: ago(10), d_address: "г. Москва, ул. Ленина, д. 5, кв. 7", heir_basis: "сын, наследник первой очереди по закону",
  property: "квартира по адресу г. Москва, ул. Ленина, д. 5, кв. 7, кадастровый номер 77:01:0001001:1234",
  buyer_name: "Иванов Сергей Петрович", buyer_address: "г. Москва, ул. Мира, д. 1", buyer_phone: "+7 900 000-00-00", app_date: iso(U.today()),
  court: "Хамовнический районный суд г. Москвы",
});
const heirs = [{ name: "Иванова Анна Петровна", address: "г. Москва, ул. Мира, д. 3" }];

t("срок ещё не истёк → ссылка на заявление нотариусу", () => {
  assert.equal(run(base, { death_date: ago(2) }).stop.link.href, "d61.html");
});

t("фактическое принятие без спора: особое производство, 3 000 ₽", () => {
  const r = run(base, { acted: "yes", dispute: "no", acts: ["lived", "paid"], proof: "справка о регистрации; квитанции ЖКУ", heirs, notary: "нотариус г. Москвы Петрова И. И." });
  assert.equal(r.d.kind, "fact"); assert.equal(r.d.fee, 3000);
  assert(r.text.includes("об установлении факта принятия наследства") && r.text.includes("пункта 9 части 2 статьи 264"));
  assert(r.text.includes("Заинтересованные лица:\nИванова Анна Петровна, адрес: г. Москва, ул. Мира, д. 3\nнотариус г. Москвы Петрова И. И."));
  assert(r.text.includes("фактически принял наследство (пункт 2 статьи 1153 ГК РФ): проживал(а) в квартире (доме) наследодателя; оплачивал(а)"));
  assert(r.text.includes("Спора о праве нет.") && r.text.includes("(3 000 ₽)") && !r.text.includes("Цена иска"));
  assert(!r.stop); assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨") && !r.text.includes(".."));
  writeDocx("d84-fact.docx", r.a, r.d);
});

t("фактическое принятие при споре: иск, пошлина от цены", () => {
  const r = run(base, { acted: "yes", dispute: "yes", acts: ["took"], heirs, share: "1/2 доли в праве собственности на квартиру", share_value: 5000000 });
  assert.equal(r.d.kind, "factClaim"); assert.equal(r.d.fee, 45000 + 2000000 * 0.007);
  assert(r.text.includes("ИСКОВОЕ ЗАЯВЛЕНИЕ") && r.text.includes("Ответчик: Иванова Анна Петровна") && r.text.includes("Цена иска: 5 000 000 ₽"));
  assert(r.text.includes("часть 3 статьи 263") && r.text.includes("право собственности в порядке наследования на 1/2 доли"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
});

t("согласие наследников: заявление нотариусу + лист согласия на каждого", () => {
  const r = run(base, { acted: "no", others: "agree", notary: "нотариус г. Москвы Петрова И. И.", passport: "45 12 345678", heirs: heirs.concat([{ name: "Иванов Олег Петрович" }]) });
  assert.equal(r.d.kind, "consent");
  assert(r.text.includes("о принятии наследства по истечении установленного срока") && r.text.includes("пункта 2 статьи 1155"));
  assert.equal((r.text.match(/СОГЛАСИЕ\n/g) || []).length, 2);
  assert(r.text.includes("Согласие наследника Иванов Олег Петрович.") && r.text.includes("Нотариус г. Москвы Петрова И. И."));
  assert(!r.text.includes("Хамовнический")); assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d84-consent.docx", r.a, r.d);
});

t("восстановление срока: ответчики-наследники, напоминание, мягкое предупреждение", () => {
  const r = run(base, { acted: "no", others: "heirs", reason: "Не знал о смерти отца: не общались с 2015 года.", learned_date: ago(1), heirs, share: "1/2 доли в праве собственности на квартиру", share_value: 5000000 });
  assert.equal(r.d.kind, "restore");
  assert(r.text.includes("о восстановлении срока для принятия наследства") && r.text.includes("по уважительной причине: Не знал о смерти отца"));
  assert(r.text.includes("признать меня принявшим наследство") && r.text.includes("определить доли наследников"));
  assert(!r.stop && spec.reminders(r.a, r.d).length === 1);
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d84-restore.docx", r.a, r.d);
  const late = run(base, { acted: "no", others: "heirs", reason: "x", learned_date: ago(8), heirs, share: "1/2", share_value: 100000 });
  assert(late.stop.soft && late.stop.action.set.others === "agree");
});

t("никто не принял: ответчик — муниципалитет, признание права", () => {
  const r = run(base, { acted: "no", others: "nobody", reason: "x", learned_date: ago(1), nobody_kind: "flat", defendant: "Администрация городского округа Подольск", share: "квартиру", share_value: 3000000 });
  assert(r.d.nobody && r.text.includes("Ответчик: Администрация городского округа Подольск") && r.text.includes("выморочное"));
  assert(r.text.includes("признании права собственности") && !r.text.includes("определить доли"));
  assert.deepEqual(allErrors(r.a), []);
});

t("подсказка о суде: наследственные споры не у мирового судьи (п. 5 ч. 1 ст. 23 ГПК; проверка 30.10.2026)", () => {
  const q = spec.steps.flatMap(s => s.questions).find(q => q.id === "court");
  const h = q.hint({ acted: "no", others: "heirs" });
  assert(h.includes("районный суд при любой цене") && !h.includes("мировой судья"));
});

done();
