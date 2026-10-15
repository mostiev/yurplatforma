/*
 * К-1. Калькулятор неустойки по Закону РФ от 07.02.1992 № 2300-1 «О защите прав потребителей».
 * Основа:
 *  — ст. 22 (возврат денег, уменьшение цены, возмещение расходов — 10 дней со дня предъявления требования),
 *    ст. 21 п. 1 (замена — 7 дней, при проверке качества — 20 дней), ст. 20 п. 1 (ремонт — срок по соглашению, не более
 *    45 дней), ст. 23 п. 1 — 1% цены товара за каждый день; с 01.02.2026 (500-ФЗ) — не больше уплаченной за товар суммы
 *    (для покупок до этой даты предела нет — переходные положения сверены по обзорам, вопрос к юристу);
 *  — ст. 23.1 п. 3 — предоплаченный товар не передан в срок: 0,5% суммы предоплаты, не больше суммы предоплаты;
 *  — ст. 28 п. 5 — просрочка работы (услуги): 3% цены работы (услуги), не больше этой цены;
 *  — ст. 31 п. 1, 3 — возврат денег за работу (услугу) с недостатками или при просрочке: 10 дней, неустойка по п. 5 ст. 28.
 * Счёт дней: со дня, следующего за последним днём срока (ст. 191 ГК), по день исполнения включительно; последний день
 * срока, выпавший на нерабочий, переносится (ст. 193 ГК). Для ст. 23.1 закон говорит «со дня, когда передача должна была
 * быть осуществлена» — считаем со следующего дня (осторожный вариант), вопрос к юристу.
 * Мораторий 01.04.2022–01.10.2022 (ПП № 497) по денежным требованиям — только предупреждение.
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;

  const KINDS = {
    refund: { rate: 1, law: "п. 1 ст. 23 (срок — ст. 22)", days: 10, what: "вернуть деньги, уменьшить цену или возместить расходы на ремонт" },
    replace: { rate: 1, law: "п. 1 ст. 23 (срок — п. 1 ст. 21)", days: 7, what: "заменить товар" },
    repair: { rate: 1, law: "п. 1 ст. 23 (срок — п. 1 ст. 20)", what: "отремонтировать товар" },
    prepaid: { rate: 0.5, law: "п. 3 ст. 23.1", cap: true, what: "передать предоплаченный товар" },
    work: { rate: 3, law: "п. 5 ст. 28", cap: true, what: "выполнить работу (оказать услугу)" },
    work_refund: { rate: 3, law: "п. 3 ст. 31 и п. 5 ст. 28", days: 10, cap: true, what: "вернуть деньги за работу (услугу)" },
  };

  const rub = n => U.money(n) + " ₽";
  const pct = x => String(x).replace(".", ",");

  const spec = {
    id: "k1",
    code: "К-1",
    title: "Неустойка по закону о защите прав потребителей",
    lead: "Магазин не вернул деньги, не заменил товар или не привёз предоплаченный заказ, исполнитель сорвал срок работы. Посчитаем неустойку по дням.",
    status: "draft",
    defaults: { kind: "refund", done: "no", check: "no", bought: "after" },

    fields: [
      { id: "kind", type: "choice", label: "Что нарушил продавец или исполнитель?", options: [
        { value: "refund", label: "Не вернул деньги за товар с недостатком", hint: "Или не уменьшил цену, не возместил расходы на ремонт — 10 дней, 1% в день" },
        { value: "replace", label: "Не заменил товар с недостатком", hint: "7 дней, при проверке качества — 20; 1% в день" },
        { value: "repair", label: "Затянул гарантийный ремонт", hint: "Срок по соглашению, но не больше 45 дней; 1% в день" },
        { value: "prepaid", label: "Не передал оплаченный заранее товар", hint: "0,5% в день от предоплаты" },
        { value: "work", label: "Сорвал срок работы или услуги", hint: "Ремонт квартиры, пошив, туроператор и т. п. — 3% в день" },
        { value: "work_refund", label: "Не вернул деньги за работу или услугу", hint: "После отказа от договора из-за недостатков или просрочки — 10 дней, 3% в день" },
      ] },
      { id: "price", type: "money", label: "Цена товара", suffix: "₽", show: a => ["refund", "replace", "repair"].includes(a.kind), hint: "Если товар подорожал — можно считать от текущей цены (п. 1 ст. 23)" },
      { id: "price", type: "money", label: "Сумма предоплаты", suffix: "₽", show: a => a.kind === "prepaid" },
      { id: "price", type: "money", label: "Цена работы или услуги", suffix: "₽", show: a => a.kind === "work" || a.kind === "work_refund", hint: "Если цена отдельного этапа в договоре не указана — общая цена заказа" },
      { id: "bought", type: "choice", label: "Когда купили товар?", show: a => ["refund", "replace", "repair"].includes(a.kind), hint: "С 1 февраля 2026 года неустойка не может быть больше уплаченной суммы (закон № 500-ФЗ)", options: [
        { value: "after", label: "1 февраля 2026 года или позже" },
        { value: "before", label: "До 1 февраля 2026 года" },
      ] },
      { id: "demand_date", type: "date", label: "Когда продавец получил ваше требование", show: a => ["refund", "replace", "work_refund"].includes(a.kind), hint: "Дата вручения претензии или получения письма" },
      { id: "check", type: "choice", label: "Продавец проводил проверку качества?", show: a => a.kind === "replace", options: [
        { value: "no", label: "Нет — срок 7 дней" },
        { value: "yes", label: "Да — срок 20 дней" },
      ] },
      { id: "due_date", type: "date", label: "Последний день срока", show: a => ["repair", "prepaid", "work"].includes(a.kind),
        hint: "Ремонт — по заказ-наряду (не больше 45 дней со дня сдачи); товар и работа — по договору" },
      { id: "done", type: "choice", label: "Требование уже выполнили?", options: [
        { value: "no", label: "Нет — считать по сегодня" },
        { value: "yes", label: "Да" },
      ] },
      { id: "done_date", type: "date", label: "Дата исполнения", show: a => a.done === "yes", hint: "День возврата денег, передачи товара, окончания работы" },
    ],

    compute(a) {
      const k = KINDS[a.kind];
      if (!k) return null;
      const price = typeof a.price === "number" && a.price > 0 ? a.price : null;
      let lastDay = null, raw = null;
      if (k.days) {
        const demand = U.date(a.demand_date);
        if (!demand) return null;
        const days = a.kind === "replace" && a.check === "yes" ? 20 : k.days;
        raw = U.addDays(demand, days);
        lastDay = C.nextWorkday(raw);
      } else {
        raw = U.date(a.due_date);
        if (!raw) return null;
        lastDay = C.nextWorkday(raw);
      }
      const end = a.done === "yes" ? U.date(a.done_date) : U.today();
      if (!price || !end) return null;
      if (end <= lastDay) return { error: `Просрочки нет: срок истекает ${U.fmtDate(lastDay)}.` };
      const from = U.addDays(lastDay, 1);
      const days = U.daysBetween(from, end) + 1;
      const perDay = Math.round(price * k.rate) / 100;
      const raw_total = Math.round(price * k.rate / 100 * days * 100) / 100;
      const cap = k.cap || (["refund", "replace", "repair"].includes(a.kind) && a.bought !== "before");
      const capped = cap && raw_total > price;
      const total = capped ? price : raw_total;
      const notes = [
        `Основание — ${k.law} Закона о защите прав потребителей: ${pct(k.rate)}% ${a.kind === "prepaid" ? "суммы предоплаты" : a.kind.startsWith("work") ? "цены работы (услуги)" : "цены товара"} за каждый день.` + (k.cap ? " Неустойка не может быть больше этой суммы." : cap ? " Неустойка не может быть больше уплаченной за товар суммы (п. 1 ст. 23 в ред. закона № 500-ФЗ, для покупок с 01.02.2026)." : " Для покупок до 01.02.2026 верхнего предела закон не устанавливал."),
        `Срок — ${k.what} — истёк ${U.fmtDate(lastDay)}` + (U.iso(raw) !== U.iso(lastDay) ? ` (последний день выпал на выходной и перенесён по ст. 193 ГК)` : "") + `. Неустойка считается с ${U.fmtDate(from)} по ${U.fmtDate(end)} включительно.`,
      ];
      if (a.kind === "prepaid") notes.push("Закон говорит «со дня, когда товар должен был быть передан» — некоторые суды считают и этот день. Мы начинаем со следующего, чтобы не завысить сумму.");
      if (U.iso(from) <= "2022-10-01" && U.iso(end) >= "2022-04-01") notes.push("Часть просрочки приходится на 01.04–01.10.2022. Если требование о деньгах возникло до 01.04.2022, неустойку за этот период мог отменить мораторий на банкротство (ПП № 497) — уточните у юриста.");
      notes.push("В суде к неустойке добавят штраф 50% от всей присуждённой суммы и компенсацию морального вреда (ст. 13, 15 Закона). Суд вправе снизить неустойку по ст. 333 ГК, если ответчик докажет её несоразмерность.");
      return {
        summary: [
          { label: "Дней просрочки", value: String(days) },
          { label: "Неустойка в день", value: rub(perDay) },
          capped ? { label: "По дням получилось", value: rub(raw_total) } : null,
          { label: capped ? "Неустойка (ограничена суммой " + (a.kind === "prepaid" ? "предоплаты)" : "цены)") : "Неустойка", value: rub(total), big: true },
        ].filter(Boolean),
        table: { head: ["Период", "Дней", "Расчёт", "Сумма"], rows: [[`${U.fmtDate(from)}–${U.fmtDate(end)}`, String(days), `${U.money(price)} × ${pct(k.rate)}% × ${days}`, rub(raw_total)]] },
        notes,
        related: a.kind === "prepaid" ? [{ id: "d53", text: "Жалоба в Роспотребнадзор" }] : a.kind.startsWith("work") ? [{ id: "d04", text: "Составить претензию", fill: { price: a.price } }] : [{ id: "d01", text: "Составить претензию", fill: { price: a.price, demand: { refund: "refund", replace: "replace_same", repair: "repair" }[a.kind] } }],
      };
    },
  };

  global.CALCS = global.CALCS || {};
  global.CALCS.k1 = spec;
})(typeof window !== "undefined" ? window : globalThis);
