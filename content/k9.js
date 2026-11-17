/*
 * К-9. Отпускные и компенсация за неиспользованный отпуск при увольнении.
 * Основа: ТК РФ — ст. 114, 115 (28 календарных дней; ч. 3 — инвалидам не менее 30, 268-ФЗ), 120 (праздники по ст. 112
 * в число дней отпуска не включаются), 121 (стаж: не включаются прогулы, отпуск по уходу за ребёнком, отпуск без
 * сохранения зарплаты сверх 14 календарных дней в рабочем году), 127 (компенсация за все неиспользованные отпуска),
 * 136 ч. 9 (отпускные — не позднее чем за 3 дня), 139 ч. 3, 4 (12 календарных месяцев; сумма / 12 / 29,3), 140 (расчёт в
 * день увольнения). Положение об исчислении средней заработной платы — ПП РФ от 24.04.2025 № 540 (с 01.09.2025 вместо
 * ПП № 922): п. 2, 3 (что учитывается), п. 4 (расчётный период), п. 5 (исключаемые периоды), п. 10 (29,3; неполный месяц:
 * 29,3 / дни месяца × отработанные календарные дни), п. 18 (средний месячный при полной норме — не ниже МРОТ; МРОТ 2026 —
 * 27 093 ₽, 429-ФЗ). Правила об очередных и дополнительных отпусках 1930 г. — п. 28 (11 месяцев — полная компенсация;
 * 5,5–11 месяцев при сокращении — полная), п. 35 (менее половины месяца — отбрасывается, не менее — полный месяц).
 * Округление дней только вверх (Роструд 04.04.2024 № ПГ/05329-6-1). НДФЛ — ст. 224 НК, ст. 217 (компенсация за
 * отпуск облагается). Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const rub = n => U.money(Math.round(n * 100) / 100) + " ₽";
  const r2 = x => Math.round(x * 100) / 100;
  const ceil2 = x => Math.ceil(x * 100 - 1e-9) / 100;
  const num = x => String(x).replace(".", ",");
  const MROT = { 2025: 22440, 2026: 27093 };
  const EXN = 3;

  // расчётный период: 12 календарных месяцев перед месяцем события; дни по ч. 4 ст. 139 и п. 10 ПП № 540
  function baseDays(event, ranges) {
    const months = [];
    for (let k = 12; k >= 1; k--) {
      const first = new Date(event.getFullYear(), event.getMonth() - k, 1);
      const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      const last = new Date(first.getFullYear(), first.getMonth(), dim);
      let excl = 0;
      for (let d = first; d <= last; d = U.addDays(d, 1)) if (ranges.some(r => d >= r[0] && d <= r[1])) excl++;
      months.push({ first, dim, excl, days: excl ? 29.3 / dim * (dim - excl) : 29.3 });
    }
    return { months, total: months.reduce((s, m) => s + m.days, 0), from: months[0].first, to: U.addDays(new Date(event.getFullYear(), event.getMonth(), 1), -1) };
  }
  // конец отпуска: праздники ст. 112 в отпуск не входят (ст. 120)
  function vacEnd(start, days) {
    let d = start, k = 0;
    for (;;) { if (!C.isHoliday112(d)) k++; if (k >= days) return d; d = U.addDays(d, 1); }
  }
  // стаж для компенсации: полные рабочие годы + месяцы последнего года с округлением по п. 35 Правил
  function service(hire, dism, skip) {
    const start = U.addDays(hire, skip || 0), end1 = U.addDays(dism, 1);
    if (end1 <= start) return { years: 0, months: 0, days: 0 };
    let years = 0;
    while (U.addMonths(start, 12 * (years + 1)) <= end1) years++;
    const ys = U.addMonths(start, 12 * years);
    let months = 0;
    while (U.addMonths(ys, months + 1) <= end1) months++;
    const days = U.daysBetween(U.addMonths(ys, months), end1);
    return { years, months, days, rounded: months + (days >= 15 ? 1 : 0) };
  }

  const exFields = Array.from({ length: EXN }, (_, i) => [
    { id: `ex${i + 1}_from`, type: "date", label: i ? `Ещё период ${i + 1}: с` : "С", show: a => a.excluded === "yes" && (i === 0 || a[`ex${i}_more`] === "yes") },
    { id: `ex${i + 1}_to`, type: "date", label: "по", show: a => a.excluded === "yes" && (i === 0 || a[`ex${i}_more`] === "yes") },
    i < EXN - 1 ? { id: `ex${i + 1}_more`, type: "choice", label: "Были ещё такие периоды?", show: a => a.excluded === "yes" && (i === 0 || a[`ex${i}_more`] === "yes"), options: [{ value: "no", label: "Нет" }, { value: "yes", label: "Да" }] } : null,
  ].filter(Boolean)).flat();

  const spec = {
    id: "k9",
    code: "К-9",
    title: "Отпускные и компенсация за отпуск",
    lead: "Сколько должны заплатить за отпуск или за неиспользованный отпуск при увольнении. По новому Положению о среднем заработке (ПП № 540), с учётом больничных и праздников.",
    status: "draft",
    actual: "08.11.2026",
    defaults: { mode: "vacation", excluded: "no", know_days: "no", annual: 28, used: 0, reduction: "no", ex1_more: "no", ex2_more: "no" },

    fields: [
      { id: "mode", type: "choice", label: "Что считаем?", options: [
        { value: "vacation", label: "Отпускные" },
        { value: "dismissal", label: "Компенсацию за отпуск при увольнении" },
      ] },
      { id: "start", type: "date", label: "Первый день отпуска", show: a => a.mode === "vacation" },
      { id: "days", type: "number", label: "Сколько календарных дней отпуска", min: 1, show: a => a.mode === "vacation", hint: "Праздники внутри отпуска не считаются — сдвинем конец отпуска" },
      { id: "dism", type: "date", label: "Последний рабочий день (день увольнения)", show: a => a.mode === "dismissal" },
      { id: "h1", type: "heading", label: "Заработок за 12 месяцев" },
      { id: "pay", type: "money", label: "Сколько начислено за 12 календарных месяцев до отпуска (увольнения)", suffix: "₽",
        hint: "Зарплата до НДФЛ, с премиями и надбавками. Без отпускных, больничных, материальной помощи — есть в расчётных листках" },
      { id: "excluded", type: "choice", label: "В эти 12 месяцев были больничные, отпуска, отпуск за свой счёт, простой?", options: [
        { value: "no", label: "Нет, работал(а) все месяцы полностью" },
        { value: "yes", label: "Да", hint: "Эти дни исключаются из расчёта" },
      ] },
      ...exFields,
      { id: "h2", type: "heading", label: "Сколько дней компенсировать", show: a => a.mode === "dismissal" },
      { id: "know_days", type: "choice", label: "Вы знаете, сколько дней отпуска у вас осталось?", show: a => a.mode === "dismissal", options: [
        { value: "yes", label: "Да", hint: "Например, из расчётного листка или от отдела кадров" },
        { value: "no", label: "Нет — посчитать по стажу" },
      ] },
      { id: "left_days", type: "number", label: "Неиспользованных дней отпуска", min: 0, step: "0.01", show: a => a.mode === "dismissal" && a.know_days === "yes" },
      { id: "hire", type: "date", label: "Дата приёма на работу", show: a => a.mode === "dismissal" && a.know_days !== "yes" },
      { id: "annual", type: "number", label: "Сколько дней отпуска положено в год", min: 1, show: a => a.mode === "dismissal" && a.know_days !== "yes", hint: "Обычно 28. Инвалидам — не меньше 30. Плюс дополнительные, если есть" },
      { id: "used", type: "number", label: "Сколько дней отпуска вы уже использовали за всё время работы", min: 0, show: a => a.mode === "dismissal" && a.know_days !== "yes" },
      { id: "skip", type: "number", label: "Дни, которые не идут в стаж", min: 0, required: false, show: a => a.mode === "dismissal" && a.know_days !== "yes",
        hint: "Отпуск по уходу за ребёнком, прогулы, отпуск за свой счёт сверх 14 дней в рабочем году (ст. 121 ТК)" },
      { id: "reduction", type: "choice", label: "Увольняют по сокращению или при ликвидации?", show: a => a.mode === "dismissal" && a.know_days !== "yes", options: [
        { value: "no", label: "Нет" },
        { value: "yes", label: "Да", hint: "Тогда при стаже в последнем рабочем году от 5,5 месяцев — полная компенсация" },
      ] },
    ],

    compute(a) {
      const vac = a.mode === "vacation";
      const event = vac ? U.date(a.start) : U.date(a.dism);
      const pay = typeof a.pay === "number" && a.pay > 0 ? a.pay : null;
      if (!event || !pay) return null;
      const ranges = [];
      if (a.excluded === "yes") for (let i = 1; i <= EXN; i++) {
        if (i > 1 && a[`ex${i - 1}_more`] !== "yes") break;
        const f = U.date(a[`ex${i}_from`]), t = U.date(a[`ex${i}_to`]);
        if (f && t && t >= f) ranges.push([f, t]);
      }
      const B = baseDays(event, ranges);
      if (B.total <= 0) return { error: "Все 12 месяцев — исключаемые периоды. В этом случае средний заработок считают по предыдущим 12 месяцам (п. 6 Положения № 540) — посчитайте за них." };
      const daily = r2(pay / B.total);
      const notes = [`Средний дневной заработок = ${U.money(pay)} ₽ ÷ ${num(r2(B.total))} дн. = ${rub(daily)} (ч. 4 ст. 139 ТК; п. 10 Положения, утв. ПП РФ от 24.04.2025 № 540). Расчётный период — ${U.fmtDate(B.from)}–${U.fmtDate(B.to)}.`];
      if (ranges.length) notes.push("Месяцы с исключёнными днями посчитаны неполными: 29,3 ÷ дней в месяце × отработанные календарные дни.");
      const mrot = MROT[event.getFullYear()];
      if (!ranges.length && mrot && pay / 12 < mrot) notes.push(`Средний месячный заработок получился ниже МРОТ (${U.money(mrot)} ₽). Если вы отработали всю норму времени, он не может быть ниже МРОТ (п. 18 Положения № 540) — тогда средний дневной не меньше ${rub(r2(mrot / 29.3))}.`);
      const rows = B.months.filter(m => m.excl).map(m => [m.first.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }), `${m.dim - m.excl} из ${m.dim}`, num(r2(m.days))]);

      let days, summary = [], related, reminders = [];
      if (vac) {
        days = typeof a.days === "number" && a.days > 0 ? Math.floor(a.days) : null;
        if (!days) return null;
        const end = vacEnd(event, days);
        const extra = U.daysBetween(event, end) + 1 - days;
        summary.push({ label: "Отпуск", value: `${U.fmtDate(event)} – ${U.fmtDate(end)}` });
        if (extra) notes.push(`В отпуск попали праздники (${extra} ${C.plural(extra, "день", "дня", "дней")}) — они не входят в отпуск и не оплачиваются, отпуск продлевается (ст. 120 ТК).`);
        notes.push(`Отпускные должны выплатить не позднее ${U.fmtDate(U.addDays(event, -3))} — за 3 дня до начала (ч. 9 ст. 136 ТК). Если заплатили позже, можно потребовать перенести отпуск (ч. 2 ст. 124) и компенсацию за задержку (К-4).`);
        related = [{ id: "d57", text: "Заявление на отпуск", fill: { kind: "annual", start_date: a.start, days } }, { id: "k4", text: "Компенсация за задержку" }];
        reminders = [{ date: U.addDays(event, -3), title: "Отпускные должны прийти", text: "Не позднее чем за 3 дня до начала отпуска (ч. 9 ст. 136 ТК)." }, { date: event, title: "Начало отпуска" }, { date: C.nextWorkday(U.addDays(end, 1)), title: "Выход на работу после отпуска", text: "Первый рабочий день по производственному календарю (при пятидневке)." }];
      } else {
        if (a.know_days === "yes") {
          days = typeof a.left_days === "number" && a.left_days >= 0 ? a.left_days : null;
          if (days == null) return null;
        } else {
          const hire = U.date(a.hire), annual = Number(a.annual) || 28;
          if (!hire) return null;
          if (hire > event) return { error: "Дата приёма позже даты увольнения." };
          const S = service(hire, event, Number(a.skip) || 0);
          const full = S.rounded >= 11 || (a.reduction === "yes" && S.rounded >= 6);
          const lastYear = full ? annual : ceil2(annual / 12 * S.rounded);
          const earned = S.years * annual + lastYear;
          days = ceil2(Math.max(0, earned - (Number(a.used) || 0)));
          notes.push(`Стаж: ${S.years} ${C.plural(S.years, "полный рабочий год", "полных рабочих года", "полных рабочих лет")} и ${S.months} мес. ${S.days} дн. в последнем году — это ${S.rounded} мес. (менее половины месяца отбрасывается, половина и больше — полный месяц: п. 35 Правил 1930 г.). ` +
            (full ? `В последнем году положен полный отпуск — ${annual} дн. (п. 28 Правил: 11 месяцев и больше${a.reduction === "yes" ? " или от 5,5 месяцев при сокращении" : ""}).` : `За последний год — ${annual} ÷ 12 × ${S.rounded} = ${num(lastYear)} дн.`) +
            ` Всего заработано ${num(r2(earned))} дн., использовано ${Number(a.used) || 0}.`);
          if (days === 0) return { summary: [{ label: "Неиспользованных дней", value: "0", big: true }], notes: notes.concat("Все заработанные дни отпуска использованы — компенсации нет. Если отпуск взят авансом, работодатель вправе удержать за неотработанные дни, но не при сокращении и ряде других оснований (ст. 137 ТК).") };
        }
        notes.push("Компенсацию выплачивают в день увольнения вместе со всем расчётом (ст. 140 ТК). За задержку — компенсация по ст. 236 (К-4).", "Дни не округляются в меньшую сторону: округлить можно только в пользу работника (Роструд, письмо от 04.04.2024 № ПГ/05329-6-1).");
        related = [{ id: "k4", text: "Компенсация за задержку" }, { id: "d27", text: "Претензия работодателю" }];
      }
      const gross = r2(daily * days);
      const tax = Math.round(gross * 0.13);
      summary.unshift({ label: vac ? "Дней отпуска" : "Дней компенсации", value: num(days) }, { label: "Средний дневной заработок", value: rub(daily) });
      summary.push({ label: vac ? "Отпускные до НДФЛ" : "Компенсация до НДФЛ", value: rub(gross) }, { label: "НДФЛ 13%", value: rub(tax) }, { label: "На руки", value: rub(gross - tax), big: true });
      notes.push("НДФЛ — 13%, если доход с начала года не больше 2,4 млн ₽; выше — 15% и больше (ст. 224 НК). Работодатель может посчитать по-другому, если в коллективном договоре предусмотрен более выгодный порядок.");
      return { summary, table: rows.length ? { head: ["Месяц с исключёнными днями", "Отработано календарных дней", "Дней в расчёт"], rows } : null, notes, related, reminders };
    },
  };

  spec.baseDays = baseDays;
  spec.service = service;
  global.CALCS = global.CALCS || {};
  global.CALCS.k9 = spec;
})(typeof window !== "undefined" ? window : globalThis);
