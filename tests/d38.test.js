// node tests/d38.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d38");
const base = {
  osp: "Хамовнический ОСП ГУФССП России по г. Москве", bailiff: "Иванова А. А.", ip_no: "123456/26/77001-ИП", ip_date: "2026-08-01", creditor: "ПАО «Банк»", what: "debt",
  income: ["salary"], group: "working", region: "г. Москва", bank: "ПАО Сбербанк", bik: "044525225", account: "4081 7810 0000 0000 0010",
  buyer_name: "Петров Пётр Петрович", buyer_birth: "1990-01-01", citizenship: "Российская Федерация", passport: "45 12 345678, выдан ГУ МВД России по г. Москве 01.02.2020",
  buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("федеральный ПМ 20 644 ₽ на 2026 год, оговорка про региональный; ч. 5.1 ст. 69, ч. 1.1 ст. 99; счёт без пробелов", () => {
  const r = run(base, {});
  assert(r.text.includes("на 2026 год — 20 644 руб.") && r.text.includes("ч. 5.1 ст. 69 и ч. 1.1 ст. 99") && r.text.includes("(г. Москва)"));
  assert(r.text.includes("счёте № 40817810000000000010, открытом в ПАО Сбербанк, БИК 044525225"));
  assert(r.text.includes("Исполнительное производство № 123456/26/77001-ИП\nВзыскатель: ПАО «Банк»") && r.text.includes("Мои доходы: заработная плата."));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨")); assert(!r.stop);
  writeDocx("d38.docx", r.a, r.d);
});

t("региональный ПМ больше федерального — указываем его", () => {
  const r = run(base, { region_pm: 28940 });
  assert(r.text.includes("для трудоспособного населения, — 28 940 руб., поскольку он превышает"));
  assert(!run(base, { region_pm: 18000 }).text.includes("18 000"), "меньший региональный не применяется");
});

t("алименты и вред — стоп по ч. 3.1 ст. 99", () => {
  assert(run(base, { what: "alimony" }).stop); assert(run(base, { what: "harm" }).stop);
});

t("проверки счёта и БИК", () => {
  const e = allErrors(run(base, { account: "2202 2000 1111 2222", bik: "04452" }).a);
  assert(e.includes("account") && e.includes("bik"));
});

t("подсказки: один счёт, иждивенцы через суд", () => {
  const g = spec.guidance(base, {}).map(x => x.text).join(" ");
  assert(g.includes("ч. 5.2 ст. 69") && g.includes("ч. 5 ст. 64.1"));
});

done();
