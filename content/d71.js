/*
 * Д-71. Взыскание долга с компании или ИП: претензия → заявление о выдаче судебного приказа → исковое заявление
 * в арбитражный суд. Расчёт долга, договорной неустойки или процентов по ст. 395 ГК и госпошлины.
 * Основа: ГК РФ — ст. 309, 310, 330, 395 (п. 4 — неустойка и проценты одновременно не взыскиваются; п. 3 — до фактической
 * оплаты, п. 48, 65 Пленума ВС № 7 от 24.03.2016), 202 п. 3 (давность приостанавливается на время претензионного
 * порядка), 203 (признание долга); специальные нормы: ст. 516 (поставка), 781 (услуги), 711 (подряд), 614 (аренда),
 * 810 (заём). АПК РФ — ч. 5 ст. 4 (претензия обязательна для денежных требований; иск — через 30 дней после
 * направления, если договором не установлено иное; для приказного производства претензия не нужна; п. 43–44 Пленума
 * ВС № 18 от 22.06.2021), ст. 35–37 (подсудность), ст. 125, 126 (требования к иску, копия ответчику), ст. 227
 * (упрощённое производство: юрлица — до 1 200 000 ₽, ИП — до 600 000 ₽, ред. 667-ФЗ), ст. 229.1–229.5 (судебный
 * приказ: до 750 000 ₽, требования подтверждены документами и признаны должником; выносится за 10 дней; возражения —
 * 10 дней). НК РФ — пп. 1, 3 п. 1 ст. 333.21 (ред. 259-ФЗ: шкала по цене иска; за приказ — 50%, не меньше 8 000 ₽).
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;
  const num = v => typeof v === "number" && !isNaN(v) ? v : null;
  const r2 = x => Math.round(x * 100) / 100;
  const ORDER_MAX = 750000;

  const SUBJECT = {
    supply: ["поставки", "ст. 506, 516 ГК РФ", "поставленный товар"],
    services: ["оказания услуг", "ст. 779, 781 ГК РФ", "оказанные услуги"],
    works: ["подряда", "ст. 702, 711 ГК РФ", "выполненные работы"],
    rent: ["аренды", "ст. 606, 614 ГК РФ", "аренду"],
    loan: ["займа", "ст. 807, 810 ГК РФ", "сумму займа"],
    other: ["", "ст. 309, 310 ГК РФ", "исполненное по договору"],
  };
  const PROOF = {
    act: "актом сверки взаимных расчётов, подписанным должником",
    letter: "гарантийным письмом должника",
    docs: "подписанными должником без возражений первичными документами (УПД, актами)",
  };

  function derive(a) {
    const calc = U.date(a.calc_date) || U.today();
    const rows = U.rows(a.debts).map(r => {
      const due = U.date(r.due), amount = num(r.amount) || 0, paid = num(r.paid) || 0;
      const rest = r2(Math.max(0, amount - paid));
      let pen = 0, days = 0;
      if (due && rest && calc > due) {
        const from = U.addDays(due, 1);
        days = U.daysBetween(from, calc) + 1;
        if (a.penalty === "contract" && num(a.rate)) {
          pen = r2(rest * a.rate / 100 * days);
          if (num(a.cap_pct)) pen = Math.min(pen, r2(amount * a.cap_pct / 100));
        } else if (a.penalty === "law395") {
          const zero = U.iso(due) < C.MORATORIUM_2022[0] ? [C.MORATORIUM_2022] : [];
          pen = C.comp395(rest, from, calc, [], { zero }).total || 0;
        }
      }
      return { doc: String(r.doc || "").trim(), due, amount, paid, rest, days, pen };
    });
    const debt = r2(rows.reduce((s, r) => s + r.rest, 0));
    const pen = r2(rows.reduce((s, r) => s + r.pen, 0));
    const price = r2(debt + pen);
    const fee = a.stage === "order" ? C.arbOrderFee(price) : C.arbFee(price);
    const claimSent = U.date(a.claim_date);
    const claimDays = num(a.claim_days) || 30;
    const suitFrom = claimSent ? U.addDays(claimSent, claimDays) : null;
    const simple = a.cr_kind === "ip" || a.db_kind === "ip" ? price <= 600000 : price <= 1200000;
    return { calc, rows, debt, pen, price, fee, claimSent, claimDays, suitFrom, simple, date: U.date(a.doc_date) };
  }

  const spec = {
    id: "d71",
    code: "Д-71",
    title: "Взыскать долг с компании или ИП: претензия, судебный приказ, иск",
    lead: "Контрагент не платит по договору. Посчитаем долг, пени или проценты и госпошлину, соберём претензию, а когда срок ответа пройдёт — заявление о судебном приказе или иск в арбитражный суд. Займёт около 10 минут.",
    status: "draft",
    actual: "08.11.2026",
    defaults: { stage: "claim", subject: "services", penalty: "contract", rate: 0.1, claim_days: 30, proof: "docs", cr_kind: "org", db_kind: "org" },

    steps: [
      {
        id: "debt", title: "Долг",
        questions: [
          { id: "stage", type: "choice", label: "Что составить?", options: [
            { value: "claim", label: "Претензию", hint: "Первый шаг: без неё иск не примут (ч. 5 ст. 4 АПК)" },
            { value: "order", label: "Заявление о судебном приказе", hint: "До 750 000 ₽, если долг подтверждён документами и признан. Быстро, без претензии и заседания",
              disabled: (a, d) => d.price > ORDER_MAX ? `Сумма ${U.money(d.price)} ₽ больше 750 000 ₽ — подходит только иск` : null },
            { value: "suit", label: "Исковое заявление", hint: "Через 30 дней после претензии (или срок из договора)" },
          ] },
          { id: "subject", type: "select", label: "Договор", options: [
            { value: "supply", label: "Поставка" }, { value: "services", label: "Услуги" }, { value: "works", label: "Подряд" },
            { value: "rent", label: "Аренда" }, { value: "loan", label: "Заём" }, { value: "other", label: "Другой" },
          ] },
          { id: "contract_no", type: "text", label: "Номер договора", required: false },
          { id: "contract_date", type: "date", label: "Дата договора" },
          { id: "debts", type: "rows", label: "Неоплаченные документы", addLabel: "+ Добавить документ", max: 30, hint: "Каждый счёт, акт или УПД — отдельной строкой. Срок оплаты — из договора или счёта",
            columns: [
              { id: "doc", label: "Документ", placeholder: "УПД № 15 от 01.08.2026", required: true, w: "1.8fr" },
              { id: "due", label: "Срок оплаты", type: "date", required: true, w: "1.1fr" },
              { id: "amount", label: "Сумма, ₽", type: "number", required: true, w: "1fr" },
              { id: "paid", label: "Оплачено, ₽", type: "number", w: "1fr" },
            ] },
          { id: "penalty", type: "choice", label: "Что начислить за просрочку", options: [
            { value: "contract", label: "Неустойку по договору", hint: "Если в договоре есть пени" },
            { value: "law395", label: "Проценты по ст. 395 ГК", hint: "Если неустойки в договоре нет — по ключевой ставке" },
            { value: "none", label: "Ничего, только долг" },
          ] },
          { id: "rate", type: "number", label: "Пени, % в день", min: 0.001, suffix: "%", show: a => a.penalty === "contract" },
          { id: "cap_pct", type: "number", label: "Ограничение пени по договору, % от суммы", required: false, suffix: "%", show: a => a.penalty === "contract", hint: "Например, «не более 10%». Оставьте пустым, если ограничения нет" },
          { id: "calc_date", type: "date", future: true, label: "Считать по дату", hint: "Обычно — дата документа. В иске попросим начислять дальше до дня оплаты" },
        ],
      },
      {
        id: "court", title: "Суд и сроки",
        questions: [
          { id: "claim_days", type: "number", label: "Срок ответа на претензию по договору, дней", min: 1, hint: "Если в договоре не указан — 30 дней" },
          { id: "claim_date", type: "date", label: "Когда отправили претензию", show: a => a.stage === "suit", hint: "Дата почтовой квитанции или письма на e-mail, если договор это допускает" },
          { id: "claim_answer", type: "choice", label: "Ответ на претензию", show: a => a.stage === "suit", options: [
            { value: "none", label: "Не ответили" }, { value: "refused", label: "Отказали" }, { value: "partial", label: "Заплатили часть", hint: "Укажите оплату в таблице" },
          ] },
          { id: "proof", type: "choice", label: "Чем подтверждается, что должник признаёт долг", show: a => a.stage === "order", hint: "Без этого суд откажет в приказе — тогда иск", options: Object.entries(PROOF).map(([value, label]) => ({ value, label: label[0].toUpperCase() + label.slice(1) })) },
          { id: "court_name", type: "text", label: "Арбитражный суд", show: a => a.stage !== "claim", hint: "По адресу должника или тот, что указан в договоре. Найти: arbitr.ru → «Суды»", placeholder: "Арбитражный суд города Москвы" },
          { id: "doc_date", type: "date", future: true, label: "Дата документа" },
        ],
      },
      { id: "creditor", title: "Вы (кредитор)", questions: C.bizParty("cr", "Кредитор", { bank: true }) },
      { id: "debtor", title: "Должник", questions: C.bizParty("db", "Должник", { noSigner: true }) },
    ],

    derive,

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      const S = SUBJECT[a.subject] || SUBJECT.other;
      const rub = x => C.rubles(x);
      const contract = `договор${S[0] ? " " + S[0] : ""}${a.contract_no ? ` № ${a.contract_no}` : ""} от ${F(U.fmtDate(U.date(a.contract_date)), "дата договора")}`;
      const penName = a.penalty === "contract" ? "неустойка (пени)" : "проценты по ст. 395 ГК РФ";
      const penAcc = a.penalty === "contract" ? "неустойку (пени)" : "проценты по ст. 395 ГК РФ";
      const table = () => {
        const head = ["№", "Документ", "Срок оплаты", "Сумма", "Оплачено", "Долг"].concat(a.penalty !== "none" ? ["Дней", a.penalty === "contract" ? "Пени" : "Проценты"] : []);
        const W = a.penalty !== "none" ? [400, 2155, 1200, 1200, 1100, 1200, 700, 1400] : [500, 3355, 1400, 1400, 1300, 1400];
        const rows = d.rows.map((r, i) => [String(i + 1), r.doc, U.fmtDate(r.due), U.money(r.amount), r.paid ? U.money(r.paid) : "—", U.money(r.rest)].concat(a.penalty !== "none" ? [String(r.days), U.money(r.pen)] : []));
        const total = [{ text: `Итого: долг ${U.money(d.debt)} руб.` + (a.penalty !== "none" ? `, ${penName} — ${U.money(d.pen)} руб., всего ${U.money(d.price)} руб.` : ""), span: head.length, bold: true }];
        P.push({ table: { head: 1, widths: W, rows: [head, ...(rows.length ? rows : [head.map(() => "")]), total] } });
      };
      const penText = a.penalty === "contract"
        ? `На основании условий договора о неустойке (ст. 330 ГК РФ) за просрочку начислены пени ${String(a.rate).replace(".", ",")}% от неоплаченной суммы за каждый день${num(a.cap_pct) ? `, но не более ${a.cap_pct}% от суммы` : ""} — ${rub(d.pen)} по состоянию на ${U.fmtDate(d.calc)}.`
        : a.penalty === "law395" ? `На сумму долга начислены проценты по ст. 395 ГК РФ по ключевой ставке Банка России — ${rub(d.pen)} по состоянию на ${U.fmtDate(d.calc)}.` : "";
      const crSign = () => P.push({ text: `${a.cr_kind === "ip" ? "Индивидуальный предприниматель" : F(a.cr_head_pos, "должность")}            ____________ / ${F(U.shortName(a.cr_kind === "ip" ? a.cr_name : a.cr_head), "И. О. Фамилия")}\n${F(U.fmtDate(d.date), "дата")}`, align: "left", before: 360 });
      const partyBlock = (role, p) => `${role}: ${C.bizName(a, p)}\nИНН ${F(a[p + "_inn"], "ИНН")}` + (a[p + "_ogrn"] ? `, ${a[p + "_kind"] === "ip" ? "ОГРНИП" : "ОГРН"} ${a[p + "_ogrn"]}` : "") + `\nАдрес: ${F(a[p + "_address"], "адрес")}` + (a[p + "_email"] ? `\nE-mail: ${a[p + "_email"]}` : "");

      if (a.stage === "claim") {
        P.push({ text: `Кому: ${C.bizName(a, "db")}\nИНН ${F(a.db_inn, "ИНН")}\nАдрес: ${F(a.db_address, "адрес")}`, align: "left", leftIndent: 4500, after: 120 });
        P.push({ text: `От: ${C.bizName(a, "cr")}\nИНН ${F(a.cr_inn, "ИНН")}\nАдрес: ${F(a.cr_address, "адрес")}` + (a.cr_email ? `\nE-mail: ${a.cr_email}` : ""), align: "left", leftIndent: 4500, after: 360 });
        C.title(P, "ПРЕТЕНЗИЯ", "о погашении задолженности");
        T(`Между нами заключён ${contract}. Мы исполнили свои обязательства в полном объёме, однако вы не оплатили ${S[2]} в установленный срок.`);
        table();
        if (penText) T(penText);
        T(`Требуем в течение ${d.claimDays} календарных дней с момента получения претензии перечислить ${rub(d.price)}${a.penalty !== "none" ? ", в том числе основной долг " + U.money(d.debt) + " руб." : ""} по реквизитам: ${a.cr_account ? `р/с ${String(a.cr_account).replace(/\s/g, "")}${a.cr_bank ? ` в ${a.cr_bank}` : ""}${a.cr_bik ? `, БИК ${a.cr_bik}` : ""}` : "указанным в договоре"}.`);
        T(`Если задолженность не будет погашена, мы обратимся в арбитражный суд с ${d.price <= ORDER_MAX ? "заявлением о выдаче судебного приказа или " : ""}иском о взыскании долга, ${a.penalty === "contract" ? "неустойки" : "процентов по ст. 395 ГК РФ"} по день фактической оплаты, а также судебных расходов, в том числе госпошлины и расходов на представителя.`);
        crSign();
        return P;
      }

      P.push({ text: `В ${F(a.court_name, "арбитражный суд")}`.replace(/^В Арбитражный суд/, "В Арбитражный суд"), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: partyBlock(a.stage === "order" ? "Взыскатель" : "Истец", "cr"), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: partyBlock(a.stage === "order" ? "Должник" : "Ответчик", "db"), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `${a.stage === "order" ? "Сумма требований" : "Цена иска"}: ${U.money(d.price)} руб.\nГосударственная пошлина: ${U.money(d.fee)} руб.`, align: "left", leftIndent: 4500, after: 360 });

      if (a.stage === "order") {
        C.title(P, "ЗАЯВЛЕНИЕ", "о выдаче судебного приказа");
        T(`Между взыскателем и должником заключён ${contract}. Взыскатель исполнил обязательства, должник не оплатил ${S[2]} в установленный срок:`);
        table();
        T(`Задолженность подтверждается документами, указанными в таблице, и признаётся должником, что подтверждается ${PROOF[a.proof] || F(null, "доказательство признания")}. До настоящего времени долг не погашен.`);
        if (penText) T(penText);
        T(`На основании ст. 309, 310, ${S[1].replace(/^ст\. /, "").replace(" ГК РФ", "")}${a.penalty === "contract" ? ", 330" : a.penalty === "law395" ? ", 395" : ""} ГК РФ, ст. 229.1–229.5 АПК РФ`);
        T(`ПРОШУ выдать судебный приказ о взыскании с ${C.bizName(a, "db")} в пользу ${C.bizName(a, "cr")}: задолженности ${rub(d.debt)}` + (a.penalty !== "none" ? `; ${a.penalty === "contract" ? "неустойки (пени)" : "процентов по ст. 395 ГК РФ"} за период по ${U.fmtDate(d.calc)} — ${rub(d.pen)}` : "") + `; расходов по уплате государственной пошлины — ${rub(d.fee)}.`);
        C.attachments(P, [`Договор ${a.contract_no ? "№ " + a.contract_no + " " : ""}от ${F(U.fmtDate(U.date(a.contract_date)), "дата")}.`, "Документы о задолженности (УПД, акты, счета) по таблице.", PROOF[a.proof] ? PROOF[a.proof][0].toUpperCase() + PROOF[a.proof].slice(1) + "." : "Документ о признании долга.", "Платёжное поручение об уплате государственной пошлины.", "Выписки из ЕГРЮЛ/ЕГРИП на взыскателя и должника.", "Доверенность представителя (если подписывает не руководитель)."]);
      } else {
        C.title(P, "ИСКОВОЕ ЗАЯВЛЕНИЕ", `о взыскании задолженности${a.penalty !== "none" ? (a.penalty === "contract" ? " и неустойки" : " и процентов за пользование чужими денежными средствами") : ""}`);
        T(`Между истцом и ответчиком заключён ${contract}. Истец исполнил обязательства, ответчик не оплатил ${S[2]} в установленный срок:`);
        table();
        if (penText) T(penText);
        T(`Претензия направлена ответчику ${F(U.fmtDate(d.claimSent), "дата претензии")}. Срок для её добровольного удовлетворения (${d.claimDays} дней) истёк ${d.suitFrom ? U.fmtDate(d.suitFrom) : F(null, "дата")}; ` + ({ none: "ответ не получен", refused: "ответчик отказал в оплате", partial: "ответчик погасил долг частично" }[a.claim_answer] || F(null, "ответ")) + ". Претензионный порядок соблюдён (ч. 5 ст. 4 АПК РФ).");
        T(`На основании ст. 309, 310, ${S[1].replace(/^ст\. /, "").replace(" ГК РФ", "")}${a.penalty === "contract" ? ", 330" : a.penalty === "law395" ? ", 395" : ""} ГК РФ, ст. 4, 125, 126 АПК РФ`);
        T(`ПРОШУ взыскать с ${C.bizName(a, "db")} в пользу ${C.bizName(a, "cr")}: 1) задолженность ${rub(d.debt)}` + (a.penalty !== "none" ? `; 2) ${penAcc} за период по ${U.fmtDate(d.calc)} — ${rub(d.pen)}; 3) ${penAcc} с ${U.fmtDate(U.addDays(d.calc, 1))} по день фактической оплаты долга${a.penalty === "contract" ? ` из расчёта ${String(a.rate).replace(".", ",")}% от суммы долга за каждый день${num(a.cap_pct) ? ` с учётом ограничения ${a.cap_pct}%` : ""}` : " по ключевой ставке Банка России"} (п. 3 ст. 395 ГК РФ, п. 48, 65 Постановления Пленума ВС РФ от 24.03.2016 № 7); 4)` : "; 2)") + ` расходы по уплате государственной пошлины — ${rub(d.fee)}.`);
        C.attachments(P, ["Документ, подтверждающий направление ответчику копии иска и приложений (почтовая квитанция с описью или иное).", "Платёжное поручение об уплате государственной пошлины.", "Претензия и доказательство её направления.", `Договор ${a.contract_no ? "№ " + a.contract_no + " " : ""}от ${F(U.fmtDate(U.date(a.contract_date)), "дата")}.`, "Документы о задолженности (УПД, акты, счета) и расчёт.", "Выписки из ЕГРЮЛ/ЕГРИП на истца и ответчика.", "Доверенность представителя (если подписывает не руководитель)."]);
      }
      crSign();
      return P;
    },

    guidance(a, d) {
      const g = [];
      if (a.stage === "claim") {
        g.push({ title: "Отправьте претензию так, чтобы доказать отправку.", text: "Почтой ценным письмом с описью вложения по адресу из ЕГРЮЛ/ЕГРИП или на e-mail, если договор это разрешает. Сохраните квитанцию: без неё иск вернут." });
        g.push({ title: `Через ${d.claimDays} дней — в суд.`, text: d.price <= ORDER_MAX
          ? `Если должник признавал долг (подписал акт сверки, УПД без возражений, гарантийное письмо) — быстрее судебный приказ: пошлина ${U.money(C.arbOrderFee(d.price))} ₽. Если спорит — иск, пошлина ${U.money(C.arbFee(d.price))} ₽. Оба документа соберёт этот же шаблон.`
          : `Иск в арбитражный суд, пошлина ${U.money(C.arbFee(d.price))} ₽. Этот же шаблон соберёт иск.` });
      } else {
        g.push({ title: `Оплатите госпошлину ${U.money(d.fee)} ₽.`, text: "Реквизиты — на сайте арбитражного суда, раздел «Госпошлина». В назначении платежа — что взыскиваете и с кого." });
        if (a.stage === "suit" && d.suitFrom && d.date && d.date < d.suitFrom) g.unshift({ title: `Подавайте не раньше ${U.fmtDate(d.suitFrom)}.`, text: "Срок ответа на претензию ещё не истёк — если подать раньше, суд вернёт иск (ч. 5 ст. 4 АПК). Поставьте дату документа позже или дождитесь срока." });
        if (a.stage === "suit") g.push({ title: "До подачи отправьте ответчику копию иска.", text: "Заказным письмом с уведомлением или с описью — квитанцию приложите к иску (ч. 3 ст. 125 АПК). " + (d.simple ? "Дело, скорее всего, рассмотрят в упрощённом порядке — без заседаний, по документам." : "") });
        g.push({ title: "Подайте через «Мой арбитр».", text: "my.arbitr.ru, вход через Госуслуги. Сканы подписываются простой электронной подписью, документы в электронном виде — квалифицированной." });
        if (a.stage === "order") g.push({ title: "Приказ — за 10 дней, у должника 10 дней на возражения.", text: "Если должник возразит, приказ отменят — тогда подавайте иск. Претензию для иска нужно будет направить заранее." });
        g.push({ title: "После решения — сразу в банк должника.", text: "Исполнительный лист или судебный приказ можно предъявить напрямую в банк, где у должника счёт (ст. 8 закона № 229-ФЗ). Это быстрее приставов." });
      }
      return g;
    },

    reminders(a, d) {
      const ev = [];
      if (a.stage === "claim" && d.date) ev.push({ date: U.addDays(d.date, d.claimDays + 7), title: "Срок ответа на претензию прошёл (с запасом на почту) — можно в суд", text: `Долг ${U.money(d.debt)} ₽` });
      if (a.stage === "order" && d.date) ev.push({ date: U.addDays(d.date, 14), title: "Проверить судебный приказ в картотеке kad.arbitr.ru" });
      return ev;
    },

    fileName(a) { return ({ claim: "Претензия о погашении долга", order: "Заявление о выдаче судебного приказа", suit: "Исковое заявление о взыскании долга" }[a.stage] || "Взыскание долга") + (a.db_name ? " — " + String(a.db_name).replace(/[«»"]/g, "").slice(0, 30) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d71 = spec;
})(typeof window !== "undefined" ? window : globalThis);
