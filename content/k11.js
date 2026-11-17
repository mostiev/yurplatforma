/*
 * К-11. Долг по алиментам и неустойка.
 * Основа: СК РФ — ст. 81 (1/4, 1/3, 1/2 заработка), ст. 113 (п. 1 — за прошедший период в пределах 3 лет до
 * предъявления листа; п. 2 — при вине должника — за весь период; п. 4 — если не работал или нет документов — по средней
 * зарплате в РФ на момент взыскания), ст. 115 п. 2 (неустойка 0,1% от невыплаченной суммы за каждый день просрочки при
 * вине должника; суд может уменьшить), ст. 117 (индексация твёрдой суммы по ПМ). 229-ФЗ — ст. 102 ч. 2, 3 (расчёт
 * приставом), ст. 67 ч. 1 п. 1 и ст. 67.1 (выезд, права — долг свыше 10 000 ₽), ст. 99 ч. 3 (до 70%). Пленум ВС от
 * 26.12.2017 № 56 — п. 5 (госпошлина по иску о неустойке — освобождение по пп. 15 п. 1 ст. 333.36 НК), п. 64 (неустойка
 * по каждому месячному платежу на день решения), п. 65 (давность — отдельно по каждому платежу). КоАП ст. 5.35.1,
 * УК ст. 157. Средняя зарплата — C.AVGWAGE (Росстат). Расчёт — C.alimonySchedule. Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const rub = n => U.money(Math.round(n * 100) / 100) + " ₽";
  const SHARE = { "1/4": 0.25, "1/3": 1 / 3, "1/2": 0.5 };
  const MON = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

  // сумма алиментов за полный месяц — общая для К-11 и Д-62
  function perMonth(a) {
    if (a.kind === "fixed") return typeof a.fixed === "number" && a.fixed > 0 ? { sum: a.fixed, how: "твёрдая сумма" } : null;
    const share = a.share === "other" ? (typeof a.share_pct === "number" && a.share_pct > 0 ? a.share_pct / 100 : null) : SHARE[a.share];
    if (!share) return null;
    const known = a.income_mode === "known";
    const base = known ? (typeof a.income === "number" && a.income > 0 ? a.income : null) : (typeof a.avg_wage === "number" && a.avg_wage > 0 ? a.avg_wage : C.AVGWAGE.value);
    if (!base) return null;
    const shareTxt = a.share === "other" ? String(a.share_pct).replace(".", ",") + "%" : a.share;
    return { sum: Math.round(base * share * 100) / 100, how: `${shareTxt} от ${known ? "дохода должника" : "средней зарплаты в РФ"} ${U.money(base)} ₽` , avg: !known, base };
  }

  const inputFields = [
    { id: "kind", type: "choice", label: "Как назначены алименты?", options: [
      { value: "share", label: "Долей от дохода: 1/4, 1/3, 1/2" },
      { value: "fixed", label: "Твёрдой суммой в месяц" },
    ] },
    { id: "share", type: "select", label: "Доля", show: a => a.kind === "share", options: [
      { value: "1/4", label: "1/4 — на одного ребёнка" }, { value: "1/3", label: "1/3 — на двоих" }, { value: "1/2", label: "1/2 — на троих и больше" },
      { value: "other", label: "Другая — в процентах" },
    ] },
    { id: "share_pct", type: "number", label: "Доля в процентах", min: 1, step: "0.01", show: a => a.kind === "share" && a.share === "other" },
    { id: "fixed", type: "money", label: "Сумма в месяц", suffix: "₽", show: a => a.kind === "fixed", hint: "С учётом индексации, если пристав её делал (ст. 117 СК)" },
    { id: "income_mode", type: "choice", label: "Что известно о доходе должника в этот период?", show: a => a.kind === "share", options: [
      { value: "unknown", label: "Не работал или доход неизвестен", hint: "Тогда долг считают от средней зарплаты в России (п. 4 ст. 113 СК)" },
      { value: "known", label: "Знаю его доход" },
    ] },
    { id: "income", type: "money", label: "Доход должника в месяц после НДФЛ", suffix: "₽", show: a => a.kind === "share" && a.income_mode === "known" },
    { id: "avg_wage", type: "money", label: "Средняя зарплата в России", suffix: "₽", required: false, show: a => a.kind === "share" && a.income_mode !== "known",
      hint: `Последняя опубликованная Росстатом — ${U.money(C.AVGWAGE.value)} ₽ за ${C.AVGWAGE.period}. Пристав берёт цифру на момент взыскания — если вышла новая, впишите её` },
    { id: "from", type: "date", label: "С какого дня не платит" },
    { id: "to", type: "date", label: "По какой день считать долг", required: false, future: true, hint: "Если пусто — по сегодня" },
    { id: "paid", type: "money", label: "Сколько он всё-таки заплатил за этот период", suffix: "₽", required: false },
  ];

  const spec = {
    id: "k11",
    code: "К-11",
    title: "Долг по алиментам и неустойка",
    lead: "Сколько задолжал плательщик алиментов и сколько неустойки можно взыскать через суд — 0,1% за каждый день просрочки по каждому месяцу.",
    status: "draft",
    actual: "30.10.2026",
    defaults: { kind: "share", share: "1/4", income_mode: "unknown" },
    fields: inputFields,

    compute(a) {
      const from = U.date(a.from);
      const today = U.today();
      const to = U.date(a.to) || today;
      const pm = perMonth(a);
      if (!from || !pm) return null;
      if (to < from) return { error: "Дата окончания раньше даты начала." };
      const S = C.alimonySchedule({ from, to, perMonth: pm.sum, paid: typeof a.paid === "number" ? a.paid : 0, calc: today > to ? today : to });
      const limit = U.addMonths(today, -36);
      const old = S.rows.filter(r => r.mEnd < limit && r.unpaid > 0);
      const rows = S.rows.map(r => [`${MON[r.month.getMonth()]} ${r.month.getFullYear()}` + (r.partDays ? ` (${r.partDays} из ${r.dim} дн.)` : ""), rub(r.accrued), rub(r.unpaid), String(r.late), rub(r.penalty)]);
      const unpaidMonths = S.rows.filter(r => r.unpaid > 0).length;
      const notes = [`В месяц: ${rub(pm.sum)} (${pm.how}).`];
      if (pm.avg) notes.push(`Если должник не работал или не показал документы о доходах, долг считают от средней зарплаты в России на момент взыскания (п. 4 ст. 113 СК, ч. 3 ст. 102 закона № 229-ФЗ). Мы взяли ${U.money(pm.base)} ₽. Если такой расчёт несправедлив, любая сторона может просить суд определить долг в твёрдой сумме.`);
      notes.push("Неустойка — 0,1% от невыплаченной суммы за каждый день просрочки, отдельно по каждому месяцу (п. 2 ст. 115 СК, п. 64 Пленума ВС № 56). Считаем, что платёж за месяц просрочен со следующего дня после его окончания. Взыскать неустойку можно только через суд (Д-62), госпошлину истец не платит. Суд может её уменьшить, если она явно несоразмерна.");
      notes.push(`Куда подавать иск: неустойка ${rub(S.penalty)} — ${S.penalty <= 50000 ? "мировому судье (до 50 000 ₽, п. 4 ч. 1 ст. 23 ГПК)" : "в районный суд (больше 50 000 ₽, ст. 24 ГПК)"}, по месту жительства ответчика или по своему (ч. 3 ст. 29 ГПК).`);
      if (old.length) notes.push(`${old.length} ${C.plural(old.length, "месяц", "месяца", "месяцев")} старше трёх лет: неустойку за них должник может оспорить по сроку исковой давности (п. 65 Пленума № 56). Долг за прошлое взыщут за 3 года до предъявления листа, а если не платил по своей вине — за весь период (ст. 113 СК).`);
      if (S.debt > 10000) notes.push("Долг больше 10 000 ₽ — пристав может запретить должнику выезд за границу и ограничить права на управление машиной (ст. 67, 67.1 закона № 229-ФЗ). Из зарплаты могут удерживать до 70% (ч. 3 ст. 99).");
      if (unpaidMonths >= 2) notes.push("Не платит два месяца и больше после возбуждения исполнительного производства — это административное правонарушение (ст. 5.35.1 КоАП: обязательные работы до 150 часов или арест до 15 суток). Повторно — уголовная ответственность (ст. 157 УК). Протокол составляет пристав — попросите об этом в заявлении (Д-62).");
      if (a.kind === "fixed") notes.push("Твёрдую сумму индексируют пропорционально росту прожиточного минимума (ст. 117 СК). Если пристав не индексировал, долг и неустойка будут больше.");
      if (S.overpaid > 0) notes.push(`Заплачено больше, чем начислено, на ${rub(S.overpaid)} — долга нет.`);
      return {
        summary: [
          { label: "Начислено за период", value: rub(S.accrued) },
          { label: "Долг", value: rub(S.debt), big: true },
          { label: `Неустойка на ${U.fmtDate(today > to ? today : to)}`, value: rub(S.penalty) },
          { label: "Всего с неустойкой", value: rub(S.debt + S.penalty) },
        ],
        table: { head: ["Месяц", "Начислено", "Не оплачено", "Дней просрочки", "Неустойка"], rows },
        notes,
        related: [{ id: "d62", text: "Заявление приставу или иск о неустойке" }, { id: "k5", text: "Сколько удержат из зарплаты" }],
      };
    },
  };

  spec.perMonth = perMonth;
  spec.inputFields = inputFields;
  global.CALCS = global.CALCS || {};
  global.CALCS.k11 = spec;
})(typeof window !== "undefined" ? window : globalThis);
