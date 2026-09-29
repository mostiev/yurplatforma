// node tests/m04.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("m04");
const base = {
  coercion: "no", holder_type: "employer", holder: "ООО «Склад-Сервис»", holder_address: "г. Москва, ул. Складская, д. 10",
  docs: ["passport", "patent", "other"], docs_other: "трудовой договор", since_date: "2026-09-01",
  story: "Забрали при приёме на работу «для оформления», обещали вернуть через неделю.", money: "yes", police: "yes",
  buyer_name: "Каримов Азиз Рустамович", citizenship: "Республика Узбекистан", birth_date: "1995-03-12", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
};

t("работодатель: требование со ст. 65 и 327.3 ТК, деньги за возврат, и заявление в полицию после разрыва страницы", () => {
  const r = run(base, {});
  assert(r.text.includes("ТРЕБОВАНИЕ") && r.text.includes("национальный паспорт, патент, трудовой договор"));
  assert(r.text.includes("ч. 1 ст. 65, ст. 327.3") && r.text.includes("Такие условия незаконны") && r.text.includes("государственную инспекцию труда"));
  assert(r.text.includes("«для оформления», обещали вернуть через неделю.") && !r.text.includes("неделю.."));
  const [dem, pol] = r.text.split("————");
  assert(pol && pol.includes("Начальнику\n________________") && pol.includes("не возвращает: ООО «Склад-Сервис» (работодатель), адрес:") && pol.includes("ст. 144 УПК") && pol.includes("талон-уведомление"));
  assert(!dem.includes("ст. 144 УПК"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨") && !r.text.includes("null"));
  writeDocx("m04.docx", r.a, r.d);
});

t("принуждение: только заявление в полицию, 112 первым в подсказках", () => {
  const r = run(base, { coercion: "yes", police_dept: "ОМВД России по району Хамовники г. Москвы" });
  assert(!r.text.includes("ТРЕБОВАНИЕ") && !r.text.includes("————") && r.text.includes("принуждают к работе") && r.text.includes("Хамовники"));
  assert.equal(r.a.police, undefined);
  assert(spec.guidance(r.a, r.d)[0].title.includes("112"));
  assert(spec.fileName(r.a).startsWith("Заявление в полицию"));
});

t("арендодатель без полиции: без ссылок на ТК, без инспекции труда", () => {
  const r = run(base, { holder_type: "landlord", holder: "Иванов Иван Иванович", police: "no", money: "no", docs: ["card", "notice"] });
  assert(r.text.includes("Никто не вправе удерживать") && !r.text.includes("ст. 65") && !r.text.includes("инспекцию труда") && !r.text.includes("ЗАЯВЛЕНИЕ"));
  assert(r.text.includes("миграционная карта, отрывная часть уведомления о прибытии"));
});

done();
