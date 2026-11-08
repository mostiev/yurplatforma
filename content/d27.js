/*
 * Д-27. Претензия работодателю о задержке заработной платы с расчётом компенсации.
 * Основа: ст. 136 ТК (сроки выплаты), ст. 140 (расчёт при увольнении), ст. 142 (приостановка работы при задержке
 * более 15 дней с письменным извещением), ст. 236 (компенсация не ниже 1/150 ключевой ставки ЦБ, действующей в это
 * время, за каждый день со следующего дня после срока по день фактического расчёта включительно).
 * Ч. 8 ст. 136 — срок в выходной сдвигается на предшествующий рабочий день (C.prevWorkday). Ставка — assets/keyrate.js. Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;

  // «15.08.2026; 45000; зарплата за первую половину августа»
  function parseDebts(text) {
    return String(text || "").split("\n").map(s => s.trim()).filter(Boolean).map(line => {
      const p = line.split(/\s*;\s*/);
      const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(p[0] || "");
      const due = m ? U.date(`${m[3]}-${m[2]}-${m[1]}`) : null;
      const amount = Number(String(p[1] || "").replace(/\s/g, "").replace(",", "."));
      return { due, amount: isFinite(amount) && amount > 0 ? amount : null, what: p.slice(2).join("; "), raw: line };
    });
  }

  function derive(a) {
    const debts = parseDebts(a.debts);
    const ok = debts.length > 0 && debts.every(x => x.due && x.amount);
    const calcDay = a.paid === "yes" ? U.date(a.paid_date) : U.today();
    // ч. 8 ст. 136 ТК: день выплаты, выпавший на выходной или праздник, сдвигается на предшествующий рабочий день
    const rows = ok ? debts.map(x => { const dueFixed = C.prevWorkday(x.due); return Object.assign({}, x, { dueFixed }, C.comp236(x.amount, dueFixed, calcDay)); }) : [];
    const principal = rows.reduce((s, r) => s + r.amount, 0);
    const comp = Math.round(rows.reduce((s, r) => s + (r.total || 0), 0) * 100) / 100;
    const maxDelay = rows.reduce((m, r) => Math.max(m, r.days), 0);
    return { debts, ok, calcDay, rows, principal, comp, maxDelay };
  }

  const spec = {
    id: "d27",
    code: "Д-27",
    title: "Претензия о задержке зарплаты с компенсацией",
    lead: "Не платят зарплату, отпускные или расчёт при увольнении. Посчитаем компенсацию по ст. 236 ТК по ставкам ЦБ за каждый день. Займёт около 5 минут.",
    status: "draft",
    actual: "08.11.2026",

    steps: [
      {
        id: "debt", title: "Долг",
        questions: [
          { id: "debts", type: "textarea", label: "Какие выплаты задержаны?",
            hint: "Каждая выплата с новой строки: дата, когда должны были заплатить; сумма к выплате на руки; что это. Например: «15.08.2026; 45000; зарплата за первую половину августа»",
            placeholder: "15.08.2026; 45000; зарплата за июль\n30.08.2026; 38000; аванс за август",
            validate: v => {
              const bad = parseDebts(v).filter(x => !x.due || !x.amount);
              return bad.length ? `Не получилось прочитать: «${bad[0].raw}». Формат: ДД.ММ.ГГГГ; сумма; что это` : null;
            } },
          { id: "paid", type: "choice", label: "Деньги уже выплатили с опозданием?", options: [
            { value: "no", label: "Нет, не выплатили до сих пор" },
            { value: "yes", label: "Да, выплатили, но не заплатили компенсацию" },
          ] },
          { id: "paid_date", type: "date", label: "Когда выплатили?", show: a => a.paid === "yes" },
          { id: "dismissed", type: "choice", label: "Вы ещё работаете там?", options: [
            { value: "working", label: "Да, работаю" },
            { value: "dismissed", label: "Нет, уже уволился(ась)" },
          ] },
          { id: "suspend", type: "choice", label: "Приостановить работу до выплаты?", hint: "Закон разрешает, если задержка больше 15 дней: вы не выходите на работу, а средний заработок сохраняется. Нельзя в армии, экстренных службах, на госслужбе и в некоторых других сферах",
            show: (a, d) => a.dismissed === "working" && a.paid === "no" && d.maxDelay > 15,
            options: [{ value: "yes", label: "Да, приостанавливаю" }, { value: "no", label: "Нет" }] },
          { id: "suspend_from", type: "date", future: true, label: "С какого дня приостанавливаете?", show: a => a.suspend === "yes" },
        ],
      },
      {
        id: "parties", title: "Стороны",
        questions: [
          { id: "org_name", type: "text", label: "Работодатель", placeholder: "ООО «Ромашка»" },
          C.innQuestion("org_inn"),
          { id: "org_address", type: "text", label: "Адрес работодателя" },
          { id: "position", type: "text", label: "Ваша должность" },
          ...C.personQuestions(),
          C.refundQuestion(),
        ],
      },
    ],

    derive,

    render(a, d) {
      const P = [];
      C.header({ name: a.org_name, nameLabel: "работодатель", inn: a.org_inn, address: a.org_address }, C.from(a), P);
      C.title(P, "ПРЕТЕНЗИЯ", "о выплате задолженности по заработной плате и денежной компенсации");
      P.push({ text: `Я ${a.dismissed === "dismissed" ? "работал(а)" : "работаю"} у вас в должности ${F(a.position, "должность")}. Работодатель не выплатил в установленный срок причитающиеся мне суммы (ст. 136${a.dismissed === "dismissed" ? ", 140" : ""} Трудового кодекса РФ):`, indent: true });
      if (d.ok) d.rows.forEach((r, i) => P.push({ text: `${i + 1}) ${r.what || "выплата"} — ${U.money(r.amount)} руб., срок выплаты ${U.fmtDate(r.due)}${U.iso(r.due) !== U.iso(r.dueFixed) ? ` (выходной день — выплата должна была быть произведена накануне, ${U.fmtDate(r.dueFixed)}, ч. 8 ст. 136 ТК РФ)` : ""};`, align: "left", leftIndent: 709, after: 40 }));
      else P.push({ text: F(null, "список задержанных выплат"), indent: true });
      if (a.paid === "yes") P.push({ text: `Задолженность в размере ${U.money(d.principal)} руб. выплачена с опозданием ${F(U.fmtDate(d.calcDay), "дата")}.`, indent: true, before: 120 });
      else P.push({ text: `Общая сумма задолженности — ${F(d.ok ? U.money(d.principal) : null, "сумма")} руб.`, indent: true, before: 120 });

      P.push({ text: `В соответствии со ст. 236 ТК РФ, при нарушении срока выплаты работодатель обязан выплатить её с уплатой денежной компенсации в размере не ниже 1/150 действующей в это время ключевой ставки Банка России от невыплаченных в срок сумм за каждый день задержки, начиная со дня, следующего за установленным днём выплаты, по день фактического расчёта включительно. Обязанность по выплате компенсации возникает независимо от вины работодателя.`, indent: true });
      if (d.ok) {
        const lines = [];
        d.rows.forEach(r => r.parts.forEach(p => lines.push(`${U.money(r.amount)} руб. × ${p.days} дн. (${U.fmtDate(p.from)}–${U.fmtDate(p.to)}) × 1/150 × ${String(p.rate).replace(".", ",")}% = ${U.money(p.sum)} руб.`)));
        P.push({ text: `Расчёт компенсации по состоянию на ${U.fmtDate(d.calcDay)}:\n` + lines.join("\n") + `\nИтого компенсация: ${U.money(d.comp)} руб.`, align: "left", leftIndent: 709 });
      }

      P.push({ text: "ТРЕБУЮ:", indent: true, keepNext: true });
      const items = [];
      if (a.paid !== "yes") items.push(`выплатить задолженность в размере ${F(d.ok ? U.money(d.principal) : null, "сумма")} руб.`);
      items.push(`выплатить денежную компенсацию по ст. 236 ТК РФ в размере ${F(d.ok ? U.money(d.comp) : null, "сумма")} руб.` + (a.paid !== "yes" ? " по состоянию на дату претензии, а также компенсацию за последующие дни по день фактического расчёта включительно" : ""));
      items.forEach((x, i) => P.push({ text: `${i + 1}. ${x[0].toUpperCase() + x.slice(1)}`, indent: true }));
      P.push({ text: `Денежные средства прошу перечислить ${C.refundText(a.refund_method)}.`, indent: true });
      if (a.suspend === "yes") P.push({ text: `Также в соответствии с ч. 2 ст. 142 ТК РФ извещаю, что в связи с задержкой выплаты заработной платы на срок более 15 дней приостанавливаю работу с ${F(U.fmtDate(U.date(a.suspend_from)), "дата")} на весь период до выплаты задержанной суммы. Приступлю к работе не позднее следующего рабочего дня после получения письменного уведомления о готовности произвести выплату в день моего выхода на работу.`, indent: true });
      P.push({ text: "В случае невыплаты я буду вынужден(а) обратиться в Государственную инспекцию труда, прокуратуру и суд с требованием о взыскании задолженности, компенсации и компенсации морального вреда (ст. 237 ТК РФ).", indent: true });
      C.sign(P, a);
      return P;
    },

    guidance(a, d) {
      const g = [
        { title: "Вручите претензию под подпись или отправьте ценным письмом с описью.", text: "Сохраните свой экземпляр с отметкой о принятии." },
        { title: "Параллельно — жалоба в трудовую инспекцию (Д-26).", text: "Задержка зарплаты — самое частое основание для проверки. Можно подать онлайн на сайте «Онлайнинспекция.рф» или через Госуслуги." },
        { title: "Срок для суда по невыплаченной зарплате — один год.", text: "Отсчитывается со дня, когда деньги должны были выплатить (ч. 2 ст. 392 ТК). Госпошлину работник по трудовым спорам не платит." },
      ];
      if (a.suspend === "yes") g.unshift({ title: "Приостановка работы — только после письменного извещения.", text: "Отдайте претензию до дня, с которого не выходите на работу, и сохраните отметку о получении. Без извещения отсутствие могут посчитать прогулом." });
      g.push({ title: "Компенсация считается по ставкам ЦБ.", text: `Таблица ставок проверена ${U.fmtDate(U.date(global.KEYRATE_CHECKED || "2026-09-28"))}. Если ставка менялась позже, пересчитайте на дату подачи.` });
      return g;
    },

    next(a, d) {
      return [{ when: "Не заплатили и после претензии", id: "d26", text: "Жалоба в трудовую инспекцию", fill: { org_name: a.org_name, org_address: a.org_address, position: a.position, violations: ["salary"] } }];
    },

    fileName(a) { return "Претензия о задержке зарплаты" + (a.buyer_name ? " — " + U.shortName(a.buyer_name) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d27 = spec;
})(typeof window !== "undefined" ? window : globalThis);
