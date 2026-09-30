/*
 * Д-65. Вернуть долг по расписке или договору займа: заявление о вынесении судебного приказа или исковое заявление.
 * Основа: ГК РФ — ст. 807 (заём с гражданином-займодавцем заключён с момента передачи денег), 808 (письменная форма
 * свыше 10 000 ₽; расписка), 809 п. 1 (без условия о размере — проценты по ключевой ставке в соответствующие периоды),
 * п. 3 (до дня возврата включительно), п. 4 (между гражданами до 100 000 ₽ — беспроцентный, если прямо не предусмотрено
 * иное), 810 п. 1 (без срока — 30 дней с требования), 811 п. 1 (за просрочку — проценты по ст. 395 независимо от
 * процентов по ст. 809), 395 п. 1, 3 (по день уплаты), 196, 200 п. 2 (давность). Пленум ВС от 24.03.2016 № 7 п. 48 (проценты
 * по ст. 395 до фактического исполнения), п. 7 Пленума ВС от 24.12.2020 № 44 и ПП № 497 (мораторий 01.04–01.10.2022 для
 * долгов, возникших до 01.04.2022). ГПК — ст. 121 (приказ — до 500 000 ₽), 122 абз. 3 (сделка в простой письменной
 * форме), 123 (по общим правилам подсудности), 124 (ч. 2 — сведения о должнике и взыскателе, идентификаторы; ч. 4 —
 * госпошлина и доказательство направления копии должнику, 135-ФЗ), 125, 126 (10 дней), 128, 129 (возражения 10 дней →
 * отмена → иск), 131, 132, 135 ч. 1 п. 1.1 (иск по бесспорному требованию до 500 000 ₽ возвращается — п. 1 Пленума ВС
 * от 27.12.2016 № 62; в сумму входят проценты и неустойки — п. 5), 23, 24, 28. Досудебная претензия по займу между
 * гражданами законом не требуется (ч. 4 ст. 3 ГПК). Госпошлина — C.courtFee (приказ — 50%, пп. 2 п. 1 ст. 333.19 НК;
 * зачёт после отмены приказа — пп. 13 п. 1 ст. 333.20). Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;
  const n = x => (typeof x === "number" && x > 0 ? x : 0);
  const r2 = x => Math.round(x * 100) / 100;

  // проценты по фиксированной ставке годовых, простые, с учётом частичного возврата
  function fixedInterest(amount, from, to, rate, pays) {
    if (!(amount > 0) || !from || !to || to < from) return { total: 0, parts: [] };
    let base = amount, d = from, total = 0;
    const parts = [];
    while (d <= to && base > 0) {
      const y = d.getFullYear(), yd = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
      const add = base * rate / 100 / yd;
      const last = parts[parts.length - 1];
      if (last && last.base === base && last.yearDays === yd) { last.days++; last.to = d; last.sum += add; }
      else parts.push({ from: d, to: d, days: 1, rate, base, yearDays: yd, sum: add });
      total += add;
      pays.filter(p => U.iso(p.date) === U.iso(d)).forEach(p => base -= p.amount);
      d = U.addDays(d, 1);
    }
    parts.forEach(p => p.sum = r2(p.sum));
    return { total: r2(total), parts };
  }

  function derive(a) {
    const loan = U.date(a.loan_date), date = U.date(a.doc_date) || U.today();
    const amount = n(a.amount);
    let due = null;
    if (a.due_type === "date") due = U.date(a.due_date);
    else if (U.date(a.demand_date)) due = U.addDays(U.date(a.demand_date), 30);
    const pays = n(a.paid) && U.date(a.paid_date) ? [{ amount: n(a.paid), date: U.date(a.paid_date) }] : [];
    const principal = r2(Math.max(0, amount - pays.reduce((s, p) => s + p.amount, 0)));
    // проценты за пользование (ст. 809)
    let mode809 = a.interest;
    if (mode809 === "none" && amount <= 100000) mode809 = "free";
    let i809 = { total: 0, parts: [] };
    if (loan && amount) {
      if (mode809 === "rate" && n(a.rate)) i809 = fixedInterest(amount, U.addDays(loan, 1), date, a.rate, pays);
      else if (mode809 === "none") i809 = C.comp395(amount, U.addDays(loan, 1), date, pays);
    }
    // проценты за просрочку (ст. 811, 395)
    let i395 = { total: 0, parts: [] };
    if (due && principal > 0 && date > due) {
      const zero = due < U.date(C.MORATORIUM_2022[0]) ? [C.MORATORIUM_2022] : [];
      i395 = C.comp395(principal, U.addDays(due, 1), date, [], { zero });
    }
    const total = r2(principal + (i809.total || 0) + (i395.total || 0));
    const order = total > 0 && total <= 500000 && a.cancelled !== "yes";
    const fullFee = total ? C.courtFee(total) : 0;
    let fee = order ? Math.round(fullFee / 2) : fullFee;
    const offset = !order && a.cancelled === "yes" ? Math.min(n(a.order_fee), fee) : 0;
    return { loan, date, amount, due, pays, principal, mode809, i809, i395, total, order, fee, offset, court: order ? "мировой судья" : total <= 50000 ? "мировой судья" : "районный суд" };
  }

  const spec = {
    id: "d65",
    code: "Д-65",
    title: "Вернуть долг по расписке",
    lead: "Заняли деньги и не отдают. Посчитаем долг и проценты по ключевой ставке, выберем путь — судебный приказ или иск — и составим заявление с расчётом и госпошлиной. Займёт около 10 минут.",
    status: "draft",
    defaults: { basis: "receipt", due_type: "date", interest: "none", cancelled: "no" },

    steps: [
      {
        id: "loan", title: "Заём",
        questions: [
          { id: "basis", type: "choice", label: "Чем подтверждён заём?", options: [
            { value: "receipt", label: "Распиской" },
            { value: "contract", label: "Договором займа" },
            { value: "none", label: "Нет письменных документов", hint: "Только переписка или перевод на карту" },
          ] },
          { id: "doc_ref", type: "text", label: "Документ: дата и номер, если есть", show: a => a.basis !== "none", placeholder: "расписка от 15.03.2025 / договор займа от 15.03.2025 № 1" },
          { id: "loan_date", type: "date", label: "Когда передали деньги" },
          { id: "amount", type: "money", label: "Сколько дали в долг", suffix: "₽" },
          { id: "due_type", type: "choice", label: "Срок возврата", options: [
            { value: "date", label: "Указан конкретный срок" },
            { value: "demand", label: "Срока нет или «до востребования»", hint: "Тогда долг нужно вернуть в течение 30 дней после требования (ст. 810 ГК)" },
          ] },
          { id: "due_date", type: "date", label: "До какого числа должны были вернуть", show: a => a.due_type === "date" },
          { id: "demand_date", type: "date", label: "Когда вы потребовали вернуть долг", required: false, show: a => a.due_type === "demand", hint: "Письменное требование или сообщение, которое можно доказать. Если ещё не требовали — сначала претензия (Д-35)" },
          { id: "interest", type: "choice", label: "Проценты за пользование деньгами", options: [
            { value: "none", label: "Про проценты ничего не сказано", hint: "Если сумма больше 100 000 ₽ — положены проценты по ключевой ставке (ст. 809 ГК)" },
            { value: "rate", label: "Указаны проценты годовых" },
            { value: "free", label: "Прямо сказано, что без процентов" },
          ] },
          { id: "rate", type: "number", label: "Сколько процентов годовых", min: 0, step: "0.01", show: a => a.interest === "rate" },
          { id: "paid", type: "money", label: "Сколько вернули", suffix: "₽", required: false },
          { id: "paid_date", type: "date", label: "Когда вернули эту часть", show: a => n(a.paid) > 0 },
          { id: "cancelled", type: "choice", label: "Уже был судебный приказ по этому долгу, и его отменили?", options: [
            { value: "no", label: "Нет" },
            { value: "yes", label: "Да — теперь нужен иск" },
          ] },
          { id: "cancel_info", type: "text", label: "Определение об отмене приказа: дата и суд", show: a => a.cancelled === "yes", placeholder: "определение мирового судьи судебного участка № 12 от 01.09.2026" },
          { id: "order_fee", type: "money", label: "Сколько заплатили госпошлины за приказ", suffix: "₽", required: false, show: a => a.cancelled === "yes", hint: "Засчитаем в госпошлину за иск" },
        ],
      },
      {
        id: "debtor", title: "Должник",
        questions: [
          { id: "debtor_name", type: "text", label: "ФИО должника" },
          { id: "debtor_address", type: "text", label: "Адрес должника", hint: "Заявление подают мировому судье или в суд по месту жительства должника" },
          { id: "debtor_birth", type: "date", label: "Дата рождения должника", required: false },
          { id: "debtor_birthplace", type: "text", label: "Место рождения", required: false },
          { id: "debtor_id", type: "text", label: "Паспорт, ИНН, СНИЛС или водительское удостоверение должника", required: false, placeholder: "паспорт 45 12 345678", hint: "Хотя бы одно, если знаете — есть в расписке. Если не знаете, так и напишем: суд запросит сам" },
          { id: "debtor_work", type: "text", label: "Место работы, если знаете", required: false },
        ],
      },
      {
        id: "you", title: "Вы и суд",
        questions: [
          { id: "buyer_name", type: "text", label: "Ваши ФИО", autocomplete: "name" },
          { id: "buyer_birth", type: "date", label: "Дата рождения" },
          { id: "buyer_birthplace", type: "text", label: "Место рождения" },
          { id: "buyer_id", type: "text", label: "Ваш паспорт, ИНН или СНИЛС", placeholder: "паспорт 45 13 123456" },
          { id: "buyer_address", type: "text", label: "Ваш адрес", autocomplete: "street-address" },
          { id: "buyer_phone", type: "tel", label: "Телефон", autocomplete: "tel" },
          { id: "court", type: "text", label: "Суд", hint: (a, d) => d && d.total ? (d.order ? "Мировой судья по месту жительства должника: найдите участок по адресу на сайте мировых судей региона" : `${d.court === "мировой судья" ? "Мировой судья" : "Районный суд"} по месту жительства должника (цена иска ${U.money(d.total)} ₽)`) : "Мировой судья или районный суд по месту жительства должника",
            placeholder: "Мировому судье судебного участка № 12 района Хамовники г. Москвы" },
          { id: "court_address", type: "text", label: "Адрес суда", required: false },
          { id: "doc_date", type: "date", future: true, label: "Дата заявления", hint: "Проценты посчитаем на эту дату" },
        ],
      },
    ],

    derive,

    stop(a, d) {
      if (a.due_type === "demand" && !U.date(a.demand_date)) return { title: "Сначала потребуйте вернуть долг.", text: "Если срок возврата не указан, долг нужно вернуть в течение 30 дней после требования (п. 1 ст. 810 ГК). Отправьте требование — претензию (Д-35) заказным письмом или сообщением, которое можно доказать, и подождите 30 дней." };
      if (d.due && d.date <= d.due) return { title: `Срок возврата ещё не наступил — ${U.fmtDate(d.due)}.`, text: "Взыскать долг можно со следующего дня после срока. Если срок «до востребования» — через 30 дней после требования." };
      if (a.basis === "none") return { title: "Без расписки или договора — только иск, и доказывать сложнее.", text: "Судебный приказ выдают только по письменной сделке. Если есть перевод на карту и переписка, где человек признаёт долг, — это доказательства для иска; суд оценит их вместе. Если перевод без назначения, должник может сказать, что это был подарок или оплата. Лучше сначала получить письменное признание долга — например, в переписке. Этот документ не подходит: обратитесь к юристу." };
      if (d.i809.error || d.i395.error) return { title: "Заём выдан раньше 17.06.2019 — посчитать проценты по ключевой ставке не сможем.", text: "У нас нет таблицы ставок за более ранний период. Документ можно составить без процентов, а проценты посчитать вручную." };
      if (d.principal <= 0) return { title: "Долг погашен.", text: "Если должник вернул долг с опозданием, можно взыскать проценты по ст. 395 ГК отдельно — посчитайте их в калькуляторе К-3." };
      return null;
    },

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      const money = x => C.rubles(x);
      const debtorIds = [U.date(a.debtor_birth) ? `дата рождения: ${U.fmtDate(U.date(a.debtor_birth))}` : null, a.debtor_birthplace ? `место рождения: ${a.debtor_birthplace}` : null, a.debtor_id || null].filter(Boolean);
      const debtorBlock = `${F(a.debtor_name, "ФИО должника")}\n` + (debtorIds.length ? debtorIds.join(", ") + "\n" : "") + `адрес: ${F(a.debtor_address, "адрес")}` + (a.debtor_work ? `\nместо работы: ${a.debtor_work}` : "");
      const unknown = !U.date(a.debtor_birth) || !a.debtor_birthplace || !a.debtor_id;
      const meBlock = `${F(a.buyer_name, "ваши ФИО")}\nдата рождения: ${F(U.fmtDate(U.date(a.buyer_birth)), "дата")}, место рождения: ${F(a.buyer_birthplace, "место рождения")}\n${F(a.buyer_id, "паспорт, ИНН или СНИЛС")}\nадрес: ${F(a.buyer_address, "адрес")}\nтел.: ${F(a.buyer_phone, "телефон")}`;
      const docName = a.basis === "contract" ? "договором займа" : "распиской должника";
      const dateStr = U.fmtDate(d.date);
      const who = d.order ? "Взыскатель" : "Истец", whom = d.order ? "Должник" : "Ответчик";
      const toPay = d.fee - d.offset;

      P.push({ text: `${F(a.court, "суд")}` + (a.court_address ? `\nАдрес: ${a.court_address}` : ""), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `${who}: ${meBlock}`, align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `${whom}: ${debtorBlock}`, align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `${d.order ? "Сумма требований" : "Цена иска"}: ${U.money(d.total)} руб.\nГосударственная пошлина: ${U.money(toPay)} руб.` + (d.offset ? ` (с зачётом ${U.money(d.offset)} руб., уплаченных за судебный приказ)` : ""), align: "left", leftIndent: 4500, after: 360 });
      C.title(P, d.order ? "ЗАЯВЛЕНИЕ" : "ИСКОВОЕ ЗАЯВЛЕНИЕ", d.order ? "о вынесении судебного приказа о взыскании долга по договору займа" : "о взыскании долга по договору займа");

      T(`${F(U.fmtDate(d.loan), "дата")} я передал(а) ${d.order ? "должнику" : "ответчику"} в заём денежные средства в размере ${d.amount ? money(d.amount) : F(null, "сумма")}, что подтверждается ${docName}${a.doc_ref ? ` (${a.doc_ref})` : ""}.` +
        (a.due_type === "date" ? ` Срок возврата займа — ${F(U.fmtDate(d.due), "срок")}.` : ` Срок возврата не установлен; ${F(U.fmtDate(U.date(a.demand_date)), "дата")} я потребовал(а) вернуть заём, поэтому он должен был быть возвращён не позднее ${U.fmtDate(d.due)} (п. 1 ст. 810 ГК РФ).`));
      T((d.pays.length ? `${U.fmtDate(d.pays[0].date)} возвращено ${money(d.pays[0].amount)}. ` : "") + `До настоящего времени долг в размере ${money(d.principal)} не возвращён.`);
      if (d.mode809 === "rate") T(`Условиями займа предусмотрены проценты за пользование займом в размере ${String(a.rate).replace(".", ",")}% годовых. За период с ${U.fmtDate(U.addDays(d.loan, 1))} по ${dateStr} они составляют ${money(d.i809.total)} (ст. 809 ГК РФ).`);
      else if (d.mode809 === "none") T(`Размер процентов за пользование займом не установлен, поэтому они определяются ключевой ставкой Банка России, действовавшей в соответствующие периоды (п. 1 ст. 809 ГК РФ). За период с ${U.fmtDate(U.addDays(d.loan, 1))} по ${dateStr} они составляют ${money(d.i809.total)}.`);
      else T("Заём является беспроцентным" + (a.interest === "none" ? " (п. 4 ст. 809 ГК РФ: сумма не превышает 100 000 рублей)" : "") + ".");
      if (d.i395.total) T(`За несвоевременный возврат займа подлежат уплате проценты по ст. 395 ГК РФ независимо от процентов за пользование займом (п. 1 ст. 811 ГК РФ). За период с ${U.fmtDate(U.addDays(d.due, 1))} по ${dateStr} они составляют ${money(d.i395.total)}` + (d.due < U.date(C.MORATORIUM_2022[0]) ? " (без учёта периода моратория с 01.04.2022 по 01.10.2022)" : "") + ".");
      T("Расчёт процентов приложен.");
      if (d.order) T("Требование основано на сделке, совершённой в простой письменной форме, и не превышает 500 000 рублей (ст. 121, абзац третий ст. 122 ГПК РФ).");
      else if (a.cancelled === "yes") T(`Ранее вынесенный судебный приказ о взыскании этого долга отменён (${F(a.cancel_info, "определение об отмене")}), поэтому требование предъявляется в порядке искового производства (ст. 129 ГПК РФ).`);
      if (unknown) T(`${[!U.date(a.debtor_birth) || !a.debtor_birthplace ? "Дата и (или) место рождения" : null, !a.debtor_id ? "идентификаторы" : null].filter(Boolean).join(" и ")} ${d.order ? "должника" : "ответчика"} мне неизвестны (${d.order ? "п. 3 ч. 2 ст. 124" : "п. 3 ч. 2 ст. 131"} ГПК РФ).`);

      P.push({ text: d.order ? "На основании изложенного, руководствуясь ст. 121–124 ГПК РФ, ПРОШУ вынести судебный приказ о взыскании с должника в мою пользу:" : "На основании изложенного, руководствуясь ст. 131, 132 ГПК РФ, ПРОШУ взыскать с ответчика в мою пользу:", indent: true, keepNext: true });
      let k = 1;
      T(`${k++}) сумму займа — ${money(d.principal)};`);
      if (d.i809.total) T(`${k++}) проценты за пользование займом за период с ${U.fmtDate(U.addDays(d.loan, 1))} по ${dateStr} — ${money(d.i809.total)};`);
      if (d.i395.total) T(`${k++}) проценты за пользование чужими денежными средствами за период с ${U.fmtDate(U.addDays(d.due, 1))} по ${dateStr} — ${money(d.i395.total)};`);
      if (!d.order) {
        if (d.mode809 !== "free") T(`${k++}) проценты за пользование займом с ${U.fmtDate(U.addDays(d.date, 1))} по день возврата суммы займа (п. 3 ст. 809 ГК РФ);`);
        T(`${k++}) проценты по ст. 395 ГК РФ на сумму долга с ${U.fmtDate(U.addDays(d.date, 1))} по день фактической уплаты долга (п. 3 ст. 395 ГК РФ, п. 48 постановления Пленума Верховного Суда РФ от 24.03.2016 № 7);`);
      }
      T(`${k++}) расходы по уплате государственной пошлины — ${money(d.fee)}.`);

      // расчёт
      const rows = [[{ text: "Период", bold: true }, { text: "Сумма, руб.", bold: true }, { text: "Ставка", bold: true }, { text: "Дней", bold: true }, { text: "Проценты, руб.", bold: true }]];
      const add = (title, parts) => {
        if (!parts.length) return;
        rows.push([{ text: title, bold: true, span: 5 }]);
        parts.forEach(p => rows.push([`${U.fmtDate(p.from)}–${U.fmtDate(p.to)}`, { text: U.money(p.base), align: "right" }, { text: `${String(p.rate).replace(".", ",")}% / ${p.yearDays}`, align: "right" }, { text: String(p.days), align: "right" }, { text: U.money(p.sum), align: "right" }]));
      };
      add("Проценты за пользование займом (ст. 809 ГК РФ)", d.i809.parts || []);
      add("Проценты за просрочку возврата (ст. 395, 811 ГК РФ)", (d.i395.parts || []).filter(p => p.rate > 0));
      if (rows.length > 1) {
        P.push({ text: "Расчёт процентов", align: "center", bold: true, before: 240, after: 120, keepNext: true });
        P.push({ table: { widths: [2600, 1800, 1500, 1000, 2455], head: 1, size: 20, rows } });
      }
      C.attachments(P, [
        `Копия ${a.basis === "contract" ? "договора займа" : "расписки"}${a.doc_ref ? ` (${a.doc_ref})` : ""}.`,
        "Расчёт взыскиваемых сумм.",
        "Документ об уплате государственной пошлины.",
        a.due_type === "demand" ? "Копия требования о возврате займа и доказательства его направления." : null,
        a.cancelled === "yes" ? "Копия определения об отмене судебного приказа." : null,
        `Документ, подтверждающий направление ${d.order ? "должнику" : "ответчику"} копии заявления и приложений (${d.order ? "ч. 4 ст. 124" : "п. 6 ст. 132"} ГПК РФ).`,
      ].filter(Boolean));
      P.push({ text: `${F(dateStr, "дата")}            ____________ / ${F(U.shortName(a.buyer_name), "И. О. Фамилия")}`, align: "left", before: 360, keepLines: true });
      return P;
    },

    guidance(a, d) {
      const g = [];
      if (d.order) g.push({ title: `Сначала — судебный приказ: сумма ${U.money(d.total)} ₽ не больше 500 000 ₽.`, text: "По распискам и договорам займа до 500 000 ₽ (с процентами) суд не примет иск, пока не было приказа (п. 1.1 ч. 1 ст. 135 ГПК). Приказ выносят за 10 дней без заседания. Если должник возразит в течение 10 дней, приказ отменят — тогда подавайте иск: выберите здесь «приказ отменили», госпошлину зачтём." });
      else g.push({ title: `Иск — ${d.court}.`, text: a.cancelled === "yes" ? "Приказ отменён — теперь по общим правилам: до 50 000 ₽ мировой судья, больше — районный суд, по месту жительства ответчика." : "Сумма больше 500 000 ₽ — приказ невозможен, сразу иск. До 50 000 ₽ — мировой судья, больше — районный суд, по месту жительства ответчика." });
      g.push(
        { title: `Госпошлина — ${U.money(d.fee - d.offset)} ₽.`, text: (d.order ? "50% от пошлины по иску (пп. 2 п. 1 ст. 333.19 НК). " : "") + "Реквизиты — на сайте суда. Её вернут с должника, если выиграете." },
        { title: "Перед подачей отправьте должнику копию заявления с приложениями.", text: "Заказным письмом с описью; квитанцию приложите (без неё заявление вернут)." },
        { title: "Оригинал расписки берегите.", text: "Суду — копию, оригинал принесёте, если попросят. Нахождение расписки у вас подтверждает, что долг не вернули (ст. 408 ГК)." },
        { title: "Срок — 3 года.", text: "С даты, когда долг должны были вернуть (ст. 196, 200 ГК). Пока дело в суде, срок не течёт (ст. 204)." },
      );
      if (d.date && d.date > d.due) g.push({ title: "Проценты растут каждый день.", text: `Мы посчитали на ${U.fmtDate(d.date)}. ${d.order ? "В приказе будет эта сумма; дальше проценты можно взыскать отдельно." : "В иске просим проценты и дальше — по день возврата долга."}` });
      return g;
    },

    fileName(a) { return "Долг по расписке — " + (a.cancelled === "yes" ? "иск" : "судебный приказ или иск") + (a.debtor_name ? " — " + U.shortName(a.debtor_name) : ""); },
  };

  spec.fixedInterest = fixedInterest;
  global.DOCS = global.DOCS || {};
  global.DOCS.d65 = spec;
})(typeof window !== "undefined" ? window : globalThis);
