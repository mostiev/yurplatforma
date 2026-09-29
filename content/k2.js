/*
 * К-2. Калькулятор неустойки застройщика за просрочку передачи квартиры (ч. 2 ст. 6 Федерального закона от 30.12.2004
 * № 214-ФЗ). Расчёт — C.dduPenalty (assets/common.js): ставка ЦБ на последний день срока по договору (определение ВС РФ
 * от 27.02.2024 № 127-КГ23-18-К4), моратории ПП № 423, № 479, № 326 (с продлениями до 31.12.2025), потолок 7,5% с
 * 01.07.2023 по 31.12.2025 (п. 2 ПП № 326); гражданину — в двойном размере, юрлицу — в одинарном. Отсрочка уплаты до
 * 31.12.2026 — ПП № 326 в ред. ПП № 2227. Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const rub = n => U.money(n) + " ₽";
  const pct = x => String(x).replace(".", ",");

  const spec = {
    id: "k2",
    code: "К-2",
    title: "Неустойка застройщика",
    lead: "Застройщик сдал квартиру позже срока по ДДУ или ещё не сдал. Посчитаем неустойку с учётом всех мораториев и ограничения ставки.",
    status: "draft",
    defaults: { who: "citizen", handed: "no" },

    fields: [
      { id: "price", type: "money", label: "Цена договора", suffix: "₽" },
      { id: "due_date", type: "date", label: "Последний день срока передачи по договору", hint: "«Не позднее IV квартала 2025 года» — это 31.12.2025. Если подписывали допсоглашение о переносе — берите новый срок" },
      { id: "handed", type: "choice", label: "Квартиру передали по акту?", options: [
        { value: "no", label: "Нет — считать по сегодня" },
        { value: "yes", label: "Да" },
      ] },
      { id: "handed_date", type: "date", label: "Дата передаточного акта", show: a => a.handed === "yes" },
      { id: "who", type: "choice", label: "Участник долевого строительства", options: [
        { value: "citizen", label: "Гражданин", hint: "Неустойка в двойном размере" },
        { value: "org", label: "Организация или ИП для бизнеса", hint: "В одинарном" },
      ] },
    ],

    compute(a) {
      const price = typeof a.price === "number" && a.price > 0 ? a.price : null;
      const due = U.date(a.due_date);
      const end = a.handed === "yes" ? U.date(a.handed_date) : U.today();
      if (!price || !due || !end) return null;
      if (end <= due) return { error: "Просрочки нет: квартира передана в срок или срок ещё не наступил." };
      const c = C.dduPenalty(price, due, end, a.who !== "org");
      if (c.error) return { error: "Нет ставки ЦБ на дату срока: расчёт поддерживается для сроков с 17.06.2019." };
      const mult = c.k === 2 ? " × 2" : "";
      return {
        summary: [
          { label: "Ставка ЦБ на " + U.fmtDate(due), value: pct(c.base) + "%" },
          { label: "Дней просрочки", value: String(c.days) },
          { label: "Из них с начислением", value: String(c.paidDays) },
          { label: "Неустойка" + (a.handed === "yes" ? "" : " на " + U.fmtDate(end)), value: rub(c.total), big: true },
        ],
        table: { head: ["Период", "Дней", "Ставка", "Сумма"], rows: c.parts.map(p => [`${U.fmtDate(p.from)}–${U.fmtDate(p.to)}`, String(p.days),
          p.rate === 0 ? "мораторий" : `${pct(p.rate)}% / 300${mult}`, rub(p.sum)]) },
        notes: [
          `Формула: цена × ставка / 300${mult} за каждый день (ч. 2 ст. 6 закона № 214-ФЗ). Ставка — на последний день срока по договору, одна на весь период (определение ВС РФ № 127-КГ23-18-К4).`,
          "Не начисляется за 03.04.2020–31.12.2020, 29.03.2022–30.06.2023 и 22.03.2024–31.12.2025. С 01.07.2023 по 31.12.2025 ставка не выше 7,5%.",
          "Застройщик вправе отложить выплату неустойки до 31.12.2026 (ПП № 326 в ред. ПП № 2227). Требовать и судиться можно уже сейчас.",
          a.who === "org" ? "В суде суд может снизить неустойку по ст. 333 ГК." : "В суде добавят штраф 5% от присуждённой суммы и моральный вред (ст. 10 закона № 214-ФЗ). Суд может снизить неустойку по ст. 333 ГК.",
        ],
        related: a.who === "org" ? [] : [{ id: "d18", text: "Составить претензию" }],
      };
    },
  };

  global.CALCS = global.CALCS || {};
  global.CALCS.k2 = spec;
})(typeof window !== "undefined" ? window : globalThis);
