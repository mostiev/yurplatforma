// node tests/d37.test.js
const assert = require("assert");
const { U, run, allErrors, t, done, writeDocx } = require("./_load")("d37");
const iso = d => U.iso(d);
const base = {
  ip: "no",
  creditors: "ПАО «Банк»; г. Москва, ул. Тверская, д. 1; кредитный договор № 123 от 01.02.2021; 180000; 25000\nООО МФК «Займ»; г. Москва, ул. Ленина, д. 5; договор займа № 45 от 10.05.2022; 30000\nООО «УК Дом»; г. Тула, ул. Мира, д. 3; оплата ЖКУ за 2023–2024 годы; 42 500,50",
  taxes: "Транспортный налог; 12000; 1500",
  ground: "returned", new_ip: "no", prev: "never",
  buyer_name: "Петров Пётр Петрович", birth_date: "1980-05-12", birth_place: "г. Тула", snils: "123-456-789 00", passport: "70 05 123456",
  buyer_address: "г. Тула, ул. Ленина, д. 5, кв. 7", buyer_phone: "+7 900 000-00-00", banks: "ПАО Сбербанк; 044525225",
};

t("основание 1: сумма без санкций, отмеченный пункт, таблицы кредиторов и налогов", () => {
  const r = run(base, {});
  assert.equal(r.d.total, 264500.5);
  assert(!r.stop);
  assert(r.text.includes("264 500 (двести шестьдесят четыре тысячи пятьсот) рублей 50 копеек"));
  assert(r.text.includes("☒ на дату подачи заявления в отношении меня окончено исполнительное производство"));
  assert(r.text.includes("☐ одновременно: мой основной доход"));
  assert(r.text.includes("1 | Кредит | ПАО «Банк» | г. Москва, ул. Тверская, д. 1 | кредитный договор № 123 от 01.02.2021 | 180 000 | 180 000 | 25 000"));
  assert(r.text.includes("| Заём | ООО МФК «Займ»") && r.text.includes("Оплата жилого помещения и коммунальных услуг"));
  assert(r.text.includes("1 | Транспортный налог | 12 000 | 1 500"));
  assert(r.text.includes("ПАО Сбербанк | 044525225"));
  assert(r.text.includes("II. Сведения о кредиторах") && r.text.includes("Нет"));
  assert(!r.text.includes("3.5.4"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨"));
  writeDocx("d37.docx", r.a, r.d);
});

t("стоп: меньше 25 000 и больше 1 млн; нет основания; новые производства", () => {
  assert(run(base, { creditors: "А; адрес; договор; 20000", taxes: "" }).stop.title.includes("меньше 25 000"));
  assert(run(base, { creditors: "А; адрес; договор; 990000" }).stop.title.includes("больше 1 000 000"));
  assert(run(base, { ground: "none" }).stop);
  assert(run(base, { new_ip: "yes" }).stop.text.includes("пп. 1 п. 1 ст. 223.2"));
});

t("пенсионер: документ выдан больше года назад, справки; меньше года — стоп с датой", () => {
  const old = iso(U.addMonths(U.today(), -13)), fresh = iso(U.addMonths(U.today(), -6));
  const r = run(base, { ground: "pension", income: "pension", doc_date: old, presented: "yes", property: "no" });
  assert(!r.stop);
  assert(r.text.includes("☒ одновременно: мой основной доход составляет пенсия") && r.text.includes("справка о том, что я являюсь получателем пенсии"));
  const s = run(base, { ground: "pension", income: "pension", doc_date: fresh, presented: "yes", property: "no" }).stop;
  assert(s.title.includes("меньше года") && s.text.includes(U.fmtDate(U.addMonths(U.date(fresh), 12))));
  assert(run(base, { ground: "pension", income: "pension", doc_date: old, presented: "yes", property: "yes" }).stop);
  assert(run(base, { ground: "pension", income: "pension", doc_date: old, presented: "no", property: "no" }).stop);
  assert(run(base, { ground: "pension", income: "svo", doc_date: old, presented: "yes", property: "no" }).text.includes("участие в специальной военной операции"));
});

t("7 лет: 6 лет — стоп; 8 лет — можно; имущество не спрашиваем", () => {
  assert(run(base, { ground: "seven", doc_date: iso(U.addMonths(U.today(), -72)), presented: "yes" }).stop.title.includes("7 лет"));
  const r = run(base, { ground: "seven", doc_date: iso(U.addMonths(U.today(), -96)), presented: "yes", property: "yes" });
  assert(!r.stop && r.a.property === undefined);
});

t("повторное обращение; ИП — раздел II и ст. 216; неверная строка кредитора", () => {
  assert(run(base, { prev: "recent" }).stop.title.includes("5 лет"));
  assert(run(base, { prev: "returned" }).stop.text.includes("п. 6 ст. 223.2"));
  const r = run(base, { ip: "was", creditors: base.creditors + "\nООО «Поставщик»; г. Тверь; договор поставки № 7 от 03.03.2020; 60000; ; ИП" });
  assert(r.text.includes("3.5.4") && r.text.includes("☒ зарегистрирован(а) или был(а)"));
  const ii = r.text.split("II. Сведения о кредиторах")[1].split("III.")[0];
  assert(ii.includes("ООО «Поставщик»") && !r.text.split("II. Сведения о кредиторах")[0].includes("Поставщик"));
  assert.equal(r.d.total, 324500.5);
  assert(allErrors(run(base, { creditors: "Банк; адрес; кредит" }).a).includes("creditors"));
  assert(allErrors(run(base, { banks: "Сбер; 12345" }).a).includes("banks"));
});

t("алименты в списке — предупреждение, что не спишут", () => {
  const r = run(base, { creditors: base.creditors + "\nИванова Анна Сергеевна; г. Тула; алименты по решению суда от 01.02.2020; 50000" });
  const g = require("./_load")("d37").spec.guidance(r.a, r.d);
  assert(g.some(x => x.text.includes("Алименты из вашего списка останутся")));
});

done();
