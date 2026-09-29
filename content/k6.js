/*
 * К-6. Калькулятор налогового вычета: сколько вернут за год и сколько перенесётся (имущественный).
 * Основа: НК РФ — ст. 219 (социальные: п. 2 — общий лимит 150 000 ₽ в год на лечение, лекарства, своё обучение и
 * обучение брата/сестры/супруга, спорт, НПО и страхование жизни — с 01.01.2024, 389-ФЗ; обучение детей — 110 000 ₽ на
 * каждого ребёнка на обоих родителей; дорогостоящее лечение — без лимита; благотворительность — не более 25% дохода),
 * ст. 220 (п. 3 — покупка жилья до 2 000 000 ₽; п. 4 — проценты по ипотеке до 3 000 000 ₽, по одному объекту;
 * п. 9 — перенос остатка на следующие годы; п. 11 — повторно не предоставляется), ст. 210 п. 3 (вычеты — из основной
 * налоговой базы), ст. 224 п. 1 (с 2025 года: 13% до 2,4 млн ₽, 15% до 5 млн, 18% до 20 млн, 20% до 50 млн, 22% свыше;
 * 2021–2024: 13% до 5 млн, 15% свыше — 372-ФЗ). Возврат = налог с дохода − налог с (дохода − вычет): прогрессия
 * учитывается автоматически. Срок — 3 последних года. Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const rub = n => U.money(Math.round(n)) + " ₽";

  // налог по основной базе за год
  function tax(year, base) {
    if (!(base > 0)) return 0;
    const steps = year >= 2025
      ? [[2400000, 13], [5000000, 15], [20000000, 18], [50000000, 20], [Infinity, 22]]
      : [[5000000, 13], [Infinity, 15]];
    let t = 0, prev = 0;
    for (const [top, rate] of steps) {
      if (base <= prev) break;
      t += (Math.min(base, top) - prev) * rate / 100;
      prev = top;
    }
    return t;
  }
  const refundFor = (year, income, deduction) => tax(year, income) - tax(year, Math.max(0, income - deduction));

  const LIM = { social: 150000, kid: 110000, flat: 2000000, mortgage: 3000000, charityShare: 0.25 };
  const YEARS = [2023, 2024, 2025];

  const spec = {
    id: "k6",
    code: "К-6",
    title: "Налоговый вычет: сколько вернут",
    lead: "Лечение, обучение, спорт, покупка квартиры, ипотека. Посчитаем, сколько налога вернут за год с учётом лимитов и новой шкалы НДФЛ, и на сколько лет растянется вычет за квартиру.",
    status: "draft",
    defaults: { year: "2025", used_flat: "no" },

    fields: [
      { id: "year", type: "select", label: "За какой год", hint: "Вычет можно получить за 3 последних года", options: YEARS.map(y => ({ value: String(y), label: `${y} год` })) },
      { id: "income", type: "money", label: "Ваш доход за этот год до вычета налога", suffix: "₽", hint: "Зарплата и другие доходы, с которых удерживали НДФЛ. Есть в личном кабинете налоговой или в справке от работодателя" },
      { id: "h1", type: "heading", label: "Социальные вычеты" },
      { id: "social", type: "money", label: "Лечение, лекарства, своё обучение, спорт", suffix: "₽", required: false, hint: "Сюда же — лечение супруга, родителей, детей и обучение брата, сестры, супруга. Вместе — не больше 150 000 ₽ в год" },
      { id: "kids", type: "number", label: "Сколько детей учились за плату", min: 0, required: false },
      { id: "kids_study", type: "money", label: "Сколько заплатили за обучение детей", suffix: "₽", required: false, show: a => a.kids > 0, hint: "До 110 000 ₽ на каждого ребёнка — на обоих родителей вместе" },
      { id: "expensive", type: "money", label: "Дорогостоящее лечение", suffix: "₽", required: false, hint: "Код услуги «2» в справке из клиники. Без лимита" },
      { id: "charity", type: "money", label: "Благотворительность", suffix: "₽", required: false, hint: "Не больше 25% дохода" },
      { id: "h2", type: "heading", label: "Квартира и ипотека" },
      { id: "flat", type: "money", label: "Сколько вы заплатили за жильё", suffix: "₽", required: false, hint: "Ваша доля расходов. Вычет — до 2 000 000 ₽ один раз в жизни" },
      { id: "used_flat", type: "choice", label: "Вы уже получали вычет за покупку жилья?", show: a => a.flat > 0, options: [
        { value: "no", label: "Нет" },
        { value: "part", label: "Да, но не весь" },
        { value: "full", label: "Да, полностью" },
      ] },
      { id: "flat_left", type: "money", label: "Сколько вычета осталось", suffix: "₽", show: a => a.flat > 0 && a.used_flat === "part", hint: "Есть в личном кабинете налоговой" },
      { id: "mortgage", type: "money", label: "Проценты по ипотеке, уплаченные за этот год", suffix: "₽", required: false, hint: "Из справки банка. Вычет по процентам — до 3 000 000 ₽ за всё время и только по одной квартире" },
    ],

    compute(a) {
      const year = Number(a.year);
      const income = typeof a.income === "number" && a.income > 0 ? a.income : null;
      if (!year || !income) return null;
      const n = k => (typeof a[k] === "number" && a[k] > 0 ? a[k] : 0);
      const social = Math.min(n("social"), LIM.social);
      const kidsCap = (a.kids > 0 ? Math.floor(a.kids) : 0) * LIM.kid;
      const kids = Math.min(n("kids_study"), kidsCap);
      const expensive = n("expensive");
      const charity = Math.min(n("charity"), income * LIM.charityShare);
      const socialTotal = social + kids + expensive + charity;
      let flatLimit = 0;
      if (n("flat") > 0 && a.used_flat !== "full") flatLimit = Math.min(n("flat"), a.used_flat === "part" ? n("flat_left") : LIM.flat);
      const mortgage = Math.min(n("mortgage"), LIM.mortgage);
      if (!socialTotal && !flatLimit && !mortgage) return { error: "Укажите хотя бы один расход — лечение, обучение, квартиру или проценты по ипотеке." };

      // сначала социальные (не переносятся), затем имущественные (остаток переносится)
      const paid = tax(year, income);
      const socialUsed = Math.min(socialTotal, income);
      const baseAfterSocial = income - socialUsed;
      const propertyThisYear = Math.min(flatLimit + mortgage, baseAfterSocial);
      const totalDeduction = socialUsed + propertyThisYear;
      const refund = refundFor(year, income, totalDeduction);
      const lostSocial = socialTotal - socialUsed;

      const rows = [[String(year), rub(totalDeduction), rub(refund)]];
      // остаток имущественного вычета (жильё и проценты) переносится — п. 9 ст. 220
      let flatLeft = Math.max(0, flatLimit + mortgage - propertyThisYear);
      let y = year, total = refund;
      while (flatLeft > 0 && rows.length < 15) {
        y++;
        const use = Math.min(flatLeft, income);
        const r = refundFor(y, income, use);
        total += r;
        rows.push([String(y), rub(use), rub(r)]);
        flatLeft -= use;
      }
      const notes = [];
      if (n("social") > LIM.social) notes.push(`Лечение, лекарства, обучение и спорт — общий лимит 150 000 ₽ в год: с ${rub(n("social"))} вычет — ${rub(LIM.social)}.`);
      if (n("kids_study") > kidsCap) notes.push(`Обучение детей — не больше 110 000 ₽ на каждого ребёнка на обоих родителей.`);
      if (lostSocial > 0) notes.push(`Социальные вычеты больше дохода: ${rub(lostSocial)} не учтутся — на следующий год они не переносятся.`);
      if (rows.length > 1) notes.push(`Остаток вычета за жильё и проценты переносится на следующие годы, пока не закончится (п. 9 ст. 220 НК). В таблице — при таком же доходе каждый год.`);
      if (mortgage && n("mortgage") > 0) notes.push("Вычет по процентам заявляйте каждый год за уплаченные в нём проценты — до 3 000 000 ₽ всего и по одной квартире.");
      notes.push(
        year >= 2025 ? "С 2025 года НДФЛ прогрессивный: с дохода свыше 2,4 млн ₽ — 15% и выше. Вычет уменьшает доход сверху, поэтому часть возвращается по повышенной ставке." : "За этот год ставка 13% (15% с дохода свыше 5 млн ₽).",
        "Вернуть можно не больше, чем с вас удержали НДФЛ за год.",
        "Семьи с двумя и более детьми и невысоким доходом могут получить ещё ежегодную семейную выплату — возврат части НДФЛ (закон от 13.07.2024 № 179-ФЗ). Это отдельная выплата через Социальный фонд, не вычет" + (U.today() <= U.date("2026-10-01") ? ": заявление за 2025 год принимают до 1 октября 2026 года." : ": заявление подают на Госуслугах или в Социальном фонде."),
        "Как получить: в личном кабинете налоговой — по готовому заявлению (упрощённый порядок: клиники, вузы, банки сами передают сведения) или декларацией 3-НДФЛ; или через работодателя — после подтверждения права налоговой. Справки об оплате лечения, обучения и спорта берите в организации (Д-59).",
      );
      return {
        summary: [
          { label: `НДФЛ за ${year} год`, value: rub(paid) },
          { label: "Вычет за год", value: rub(totalDeduction) },
          { label: `Вернут за ${year} год`, value: rub(refund), big: true },
          rows.length > 1 ? { label: `Всего вернут за ${rows.length} ${C.plural(rows.length, "год", "года", "лет")}`, value: rub(total) } : null,
        ].filter(Boolean),
        table: rows.length > 1 ? { head: ["Год", "Вычет", "Вернут"], rows } : null,
        notes,
        related: [{ id: "d59", text: "Справка для вычета" }],
      };
    },
  };

  spec.tax = tax;
  global.CALCS = global.CALCS || {};
  global.CALCS.k6 = spec;
})(typeof window !== "undefined" ? window : globalThis);
