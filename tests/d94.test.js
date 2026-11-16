// node tests/d94.test.js
const assert = require("assert");
const { run, allErrors, t, done, writeDocx } = require("./_load")("d94");
const base = {
  mode: "agree", who: "parent", children: [{ name: "Петрова Анна Петровна", birth: "2018-04-10" }],
  buyer_name: "Петров Пётр Петрович", buyer_address: "г. Москва, ул. Ленина, д. 5", buyer_phone: "+7 900 000-00-00",
  other_name: "Иванова Мария Сергеевна", other_address: "г. Москва, ул. Тверская, д. 1", together: "divorced",
  weekdays: ["wed"], wd_from: "17:00", wd_to: "20:00", weekend: "alt", overnight: "yes", we_from: "10:00", we_to: "18:00", holidays: "yes", vacation: 14, calls: "yes", place: "mine",
};

t("соглашение: стороны, график по будням и выходным с ночёвкой, отпуск, подписи двоих", () => {
  const r = run(base, {});
  assert(r.text.includes("СОГЛАШЕНИЕ") && r.text.includes("ст. 61, 65, 66 Семейного кодекса"));
  assert(r.text.includes("по будням: в среду с 17:00 до 20:00") && r.text.includes("каждые вторые выходные (через неделю): с 10:00 субботы до 18:00 воскресенья — с ночёвкой"));
  assert(r.text.includes("14 дней подряд") && r.text.includes("Сторона 2: ____________ / Иванова М. С."));
  assert(!r.text.includes("ИСКОВОЕ"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text);
  writeDocx("d94.docx", r.a, r.d);
});

t("иск: опека третьим лицом, пошлина 3 000, ст. 66 и Пленум № 10, мнение ребёнка с 10 лет", () => {
  const r = run(base, { mode: "court", buyer_birth: "1988-01-01", buyer_birthplace: "г. Москва", buyer_id: "СНИЛС 1", obstacles: "Не открывает дверь", court: "Хамовнический районный суд г. Москвы", opeka: "Отдел опеки района Хамовники", children: [{ name: "Петрова Анна Петровна", birth: "2014-04-10" }] });
  assert(r.text.includes("Третье лицо: Отдел опеки района Хамовники") && r.text.includes("Государственная пошлина: 3 000 руб."));
  assert(r.text.includes("п. 1 ст. 66 СК РФ") && r.text.includes("п. 8 постановления Пленума ВС РФ от 27.05.1998 № 10") && r.text.includes("ст. 57 СК РФ"));
  assert(r.text.includes("1. Определить порядок моего общения с ребёнком") && r.text.includes("Копия свидетельства о расторжении брака."));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"), r.text);
});

t("бабушка: ст. 67 СК, без вопроса о браке", () => {
  const r = run(base, { mode: "court", who: "grand", relation: "бабушкой", buyer_birth: "1960-01-01", buyer_birthplace: "г. Тула", buyer_id: "СНИЛС 1", obstacles: "Запрещают встречи", court: "Суд", opeka: "Опека" });
  assert(r.text.includes("п. 1 ст. 67 СК РФ") && r.text.includes("Я прихожусь бабушкой ребёнку") && r.a.together === undefined);
});

t("ребёнку 18 — стоп", () => {
  assert(run(base, { children: [{ name: "А", birth: "2005-01-01" }] }).stop);
});

done();
