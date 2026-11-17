/*
 * Д-67. Выезд и расторжение договора найма: уведомление жильца, соглашение о расторжении с актом возврата и расчётом
 * залога, уведомление собственника об отказе от договора, предложение расторгнуть договор (перед иском).
 * Основа: ГК РФ — ст. 687 (п. 1 — наниматель вправе расторгнуть с письменным предупреждением за 3 месяца, срок можно
 * согласовать в договоре; п. 2 — расторжение по требованию наймодателя в суде), ст. 450, 450.1 (односторонний отказ,
 * если он предусмотрен договором; постановление КС РФ от 02.06.2022 № 23-П — для краткосрочного найма по ясно
 * определённым основаниям), ст. 452 п. 2 (иск о расторжении — после отказа другой стороны или неполучения ответа в
 * 30 дней), ст. 381.1 (обеспечительный платёж: зачёт и возврат), ст. 314 п. 2 (7 дней, если срок возврата не установлен),
 * ст. 395. Госрегистрация прекращения обременения при найме от года — 218-ФЗ; пошлина за соглашение о расторжении —
 * ст. 333.33 НК.
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;

  const num = v => typeof v === "number" && !isNaN(v) ? v : null;
  const r2 = x => Math.round(x * 100) / 100;
  const GROUND = {
    late: "невнесение платы за наём сверх срока, установленного договором",
    damage: "порча помещения или имущества",
    sublet: "передача помещения третьим лицам без моего согласия",
    rules: "повторное нарушение условий договора о проживании после предупреждения",
    other: "иное нарушение условий договора",
  };

  function derive(a) {
    const contract = U.date(a.contract_date);
    const date = U.date(a.doc_date);
    const rent = num(a.rent) || 0;
    const deposit = num(a.deposit) || 0;
    const noticeDays = num(a.notice_days);
    const out = U.date(a.move_out);
    // жилец уведомляет: самый ранний законный день выезда — дата уведомления + срок предупреждения
    const earliest = date && noticeDays ? U.addDays(date, noticeDays) : null;
    const shortDays = a.route === "notice" && out && earliest && out < earliest ? U.daysBetween(out, earliest) : 0;
    const daily = rent ? r2(rent * 12 / 365) : 0;
    const hold = shortDays && a.hold_ok === "yes" ? r2(daily * shortDays) : 0;
    // собственник отказывается: договор прекращается через срок из уведомления
    const endByRefusal = date && noticeDays ? U.addDays(date, noticeDays) : null;
    const items = U.rows(a.debts).map(r => ({ what: String(r.what || "").trim(), sum: num(r.sum) || 0 })).filter(r => r.what || r.sum);
    const debtSum = r2(items.reduce((s, r) => s + r.sum, 0));
    const toReturn = r2(deposit - debtSum);
    const last = a.route === "refusal" ? endByRefusal : out;
    const returnBy = last && num(a.return_days) ? U.addDays(last, a.return_days) : null;
    return { contract, date, rent, deposit, noticeDays, out, earliest, shortDays, daily, hold, endByRefusal, items, debtSum, toReturn, last, returnBy };
  }

  const spec = {
    id: "d67",
    code: "Д-67",
    title: "Выезд из съёмной квартиры и расторжение договора найма",
    lead: "Уведомление о выезде, соглашение о расторжении с актом возврата и расчётом залога — или уведомление собственника об отказе от договора. Займёт около 7 минут.",
    status: "draft",
    actual: "30.10.2026",
    defaults: { role: "tenant", route: "notice", notice_days: 30, hold_ok: "yes", return_days: 7, grounds: "late" },

    steps: [
      {
        id: "what", title: "Что нужно",
        questions: [
          { id: "role", type: "choice", label: "Вы —", options: [
            { value: "tenant", label: "Жилец (наниматель)" },
            { value: "owner", label: "Собственник (наймодатель)" },
          ] },
          { id: "route", type: "choice", label: "Что составить?", options: [
            { value: "notice", label: "Уведомление о выезде", hint: "Жилец сам расторгает договор, предупредив собственника" },
            { value: "agreement", label: "Соглашение о расторжении + акт возврата", hint: "Обе стороны договорились: дата выезда, расчёт по залогу" },
            { value: "refusal", label: "Уведомление жильцу об отказе от договора", hint: "Если в договоре есть право собственника отказаться при нарушениях" },
            { value: "claim", label: "Предложение жильцу расторгнуть договор", hint: "Если права отказа в договоре нет: без этого письма суд иск не примет" },
          ].map(o => Object.assign(o, { disabled: a => o.value === "notice" ? (a.role === "owner" ? "Это вариант для жильца" : null) : (o.value === "refusal" || o.value === "claim") && a.role === "tenant" ? "Это вариант для собственника" : null })) },
          { id: "contract_date", type: "date", label: "Дата договора найма" },
          { id: "address", type: "text", label: "Адрес квартиры", placeholder: "г. Москва, ул. Ленина, д. 5, кв. 7" },
          { id: "rent", type: "money", label: "Плата в месяц по договору", suffix: "₽" },
          { id: "deposit", type: "money", label: "Залог (обеспечительный платёж)", suffix: "₽", required: false, hint: "Оставьте пустым, если залога нет" },
          { id: "long", type: "choice", label: "Договор заключён на год или больше и зарегистрирован в Росреестре?", options: [
            { value: "no", label: "Нет" }, { value: "yes", label: "Да" },
          ] },
        ],
      },
      {
        id: "terms", title: "Сроки и деньги",
        questions: [
          { id: "doc_date", type: "date", future: true, label: a => a.route === "agreement" ? "Дата соглашения" : "Дата, когда отправите или вручите", hint: "Срок предупреждения считается со дня, когда другая сторона получила уведомление. Отправляйте в мессенджер, если договор это разрешает, и дублируйте письмом" },
          { id: "notice_days", type: "number", label: a => a.route === "refusal" ? "За сколько дней по договору вы уведомляете жильца" : "За сколько дней по договору нужно предупредить", min: 1, show: a => a.route === "notice" || a.route === "refusal", hint: "Посмотрите раздел о расторжении. Если в договоре ничего нет — 90 дней (3 месяца, п. 1 ст. 687 ГК)" },
          { id: "move_out", type: "date", future: true, label: a => a.route === "agreement" ? "Последний день найма (день возврата ключей)" : "Когда хотите съехать", show: a => a.route === "notice" || a.route === "agreement" },
          { id: "hold_ok", type: "choice", label: (a, d) => "Съезжаете раньше срока предупреждения. Как рассчитаться?", show: (a, d) => a.route === "notice" && d.shortDays > 0,
            hint: (a, d) => `Не хватает ${d.shortDays} ${C.plural(d.shortDays, "дня", "дней", "дней")}. Предложите удержать плату за них из залога — это ${U.money(r2(d.daily * d.shortDays))} ₽ (${U.money(d.daily)} ₽ в день). Собственнику так проще согласиться`, options: [
            { value: "yes", label: "Согласен(на) на удержание из залога" },
            { value: "no", label: "Не предлагать", hint: "Собственник вправе требовать плату за весь срок предупреждения" },
          ] },
          { id: "grounds", type: "select", label: "За какое нарушение", show: a => a.route === "refusal" || a.route === "claim", options: Object.entries(GROUND).map(([value, label]) => ({ value, label: label[0].toUpperCase() + label.slice(1) })) },
          { id: "violation", type: "textarea", label: "Что именно произошло", show: a => a.route === "refusal" || a.route === "claim", placeholder: "Плата за август 2026 года (60 000 руб.) не внесена до сих пор, хотя срок — 5 августа.\nВ июле я письменно напоминал(а) об оплате." },
          { id: "contract_clause", type: "text", label: "Пункт договора, который даёт право отказа", show: a => a.route === "refusal", placeholder: "6.2" },
          { id: "debts", type: "rows", label: a => a.route === "agreement" ? "Что удерживается из залога" : "Долги жильца (будут удержаны из залога)", required: false, show: a => a.route !== "notice", addLabel: "+ Добавить", hint: "Долг по плате, неоплаченная коммуналка, ремонт испорченного. Оставьте пустым, если удержаний нет",
            columns: [{ id: "what", label: "За что", required: true, w: "2fr" }, { id: "sum", label: "Сумма, ₽", type: "number", w: "1fr" }],
            presets: ["Коммунальные услуги по счётчикам", "Плата за наём", "Химчистка", "Замена замка", "Ремонт техники"] },
          { id: "return_days", type: "choice", label: "Когда вернуть залог", show: (a, d) => d.deposit > 0 && a.route !== "claim", options: [
            { value: 0, label: "В день выезда" }, { value: 3, label: "3 дня" }, { value: 7, label: "7 дней", hint: "Если в договоре срок не указан — 7 дней после требования (ст. 314 ГК)" }, { value: 14, label: "14 дней" },
          ] },
          { id: "keys", type: "number", label: "Сколько комплектов ключей возвращается", min: 0, show: a => a.route === "agreement" },
          { id: "m_el", type: "number", label: "Счётчик: электроэнергия, кВт·ч", required: false, show: a => a.route === "agreement" },
          { id: "m_cold", type: "number", label: "Счётчик: холодная вода, м³", required: false, show: a => a.route === "agreement" },
          { id: "m_hot", type: "number", label: "Счётчик: горячая вода, м³", required: false, show: a => a.route === "agreement" },
        ],
      },
      {
        id: "parties", title: "Стороны",
        questions: [
          { id: "ll_name", type: "text", label: "ФИО собственника (наймодателя)" },
          { id: "ll_phone", type: "tel", label: "Телефон собственника", required: false },
          { id: "tn_name", type: "text", label: "ФИО жильца (нанимателя)" },
          { id: "tn_phone", type: "tel", label: "Телефон жильца", required: false },
          { id: "address_from", type: "text", label: "Ваш адрес для ответа", required: false, show: a => a.route !== "agreement", hint: "Можно не указывать, если общаетесь в мессенджере" },
        ],
      },
    ],

    derive,

    stop: null,

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      const rub = x => C.rubles(x);
      const city = (String(a.address || "").split(",")[0] || "").trim();
      const contract = `договор найма жилого помещения от ${F(U.fmtDate(d.contract), "дата договора")} по адресу: ${F(a.address, "адрес")}`;
      const tenant = a.role === "tenant";
      const me = tenant ? { name: a.tn_name, phone: a.tn_phone } : { name: a.ll_name, phone: a.ll_phone };
      const to = tenant ? { name: a.ll_name, phone: a.ll_phone } : { name: a.tn_name, phone: a.tn_phone };
      const head = () => {
        P.push({ text: `${tenant ? "Наймодателю" : "Нанимателю"}: ${F(to.name, "ФИО")}` + (to.phone ? `\nТел.: ${to.phone}` : ""), align: "left", leftIndent: 4500, after: 120 });
        P.push({ text: `От ${tenant ? "нанимателя" : "наймодателя"}: ${F(me.name, "ФИО")}` + (a.address_from ? `\nАдрес: ${a.address_from}` : "") + (me.phone ? `\nТел.: ${me.phone}` : ""), align: "left", leftIndent: 4500, after: 360 });
      };
      const sign = () => P.push({ text: `${F(U.fmtDate(d.date), "дата")}            ____________ / ${F(U.shortName(me.name), "И. О. Фамилия")}`, align: "left", before: 360 });
      const lc = x => x ? x[0].toLowerCase() + x.slice(1) : x;
      const debtList = () => d.items.map(r => `${lc(r.what) || "удержание"} — ${U.money(r.sum)} руб.`).join("; ");

      const agreement = draft => {
        P.push({ text: "СОГЛАШЕНИЕ", align: "center", bold: true, after: 0 });
        P.push({ text: `о расторжении договора найма жилого помещения от ${F(U.fmtDate(d.contract), "дата договора")}`, align: "center", after: 240 });
        P.push({ text: `${F(city, "город")}                                                                          ${draft ? "«___» ____________ 20__ г." : F(U.fmtDate(d.date), "дата")}`, align: "left", after: 240 });
        T(`${F(a.ll_name, "ФИО наймодателя")} (Наймодатель) и ${F(a.tn_name, "ФИО нанимателя")} (Наниматель) заключили настоящее соглашение о нижеследующем.`);
        let k = 0; const N = t => { k++; T(`${k}. ${t}`); };
        N(`Стороны расторгают ${contract} (далее — Договор) по соглашению сторон (п. 1 ст. 450 ГК РФ). Последний день найма — ${draft ? "«___» ____________ 20__ г." : F(U.fmtDate(d.out), "дата")}.`);
        N("В последний день найма Наниматель освобождает помещение, возвращает его, имущество и все комплекты ключей Наймодателю по акту возврата, а Наймодатель принимает их. Коммунальные услуги оплачиваются по показаниям приборов учёта на день возврата.");
        if (d.deposit) {
          N(d.items.length
            ? `Из обеспечительного платежа в размере ${rub(d.deposit)} Наймодатель удерживает: ${debtList()}, всего ${rub(d.debtSum)}.`
            : `Обеспечительный платёж в размере ${rub(d.deposit)} удержаниям не подлежит.`);
          if (d.toReturn > 0) N(`Наймодатель возвращает Нанимателю ${rub(d.toReturn)} ${num(a.return_days) === 0 ? "в последний день найма" : `не позднее ${F(U.fmtDate(d.returnBy), "дата")}`} наличными под расписку или переводом на счёт Нанимателя.`);
          else if (d.toReturn < 0) N(`Задолженность Нанимателя сверх обеспечительного платежа составляет ${rub(-d.toReturn)}; Наниматель погашает её не позднее последнего дня найма.`);
        } else if (d.items.length) N(`Наниматель уплачивает Наймодателю не позднее последнего дня найма: ${debtList()}, всего ${rub(d.debtSum)}.`);
        N("После исполнения настоящего соглашения стороны не имеют друг к другу претензий по Договору, за исключением претензий о повреждениях, которые будут выявлены при подписании акта возврата.");
        if (a.long === "yes") N("Стороны совместно обращаются в орган регистрации прав за погашением записи об ограничении (обременении) права в течение 10 рабочих дней после подписания настоящего соглашения.");
        N(`Соглашение составлено в ${a.long === "yes" ? "трёх" : "двух"} экземплярах и вступает в силу с момента подписания.`);
        P.push({ text: `Наймодатель ____________ / ${F(U.shortName(a.ll_name), "И. О. Фамилия")}                    Наниматель ____________ / ${F(U.shortName(a.tn_name), "И. О. Фамилия")}`, align: "left", before: 360, keepLines: true });
      };

      const returnAct = () => {
        P.push({ pageBreak: true });
        P.push({ text: "АКТ ВОЗВРАТА", align: "center", bold: true, after: 0 });
        P.push({ text: "жилого помещения и имущества по договору найма", align: "center", after: 240 });
        P.push({ text: `${F(city, "город")}                                                                          ${F(U.fmtDate(d.out), "дата")}`, align: "left", after: 240 });
        let k = 0; const N = t => { k++; T(`${k}. ${t}`); };
        N(`Наниматель ${F(a.tn_name, "ФИО")} возвратил, а Наймодатель ${F(a.ll_name, "ФИО")} принял помещение по адресу: ${F(a.address, "адрес")} и имущество по описи к договору найма.`);
        N(d.items.some(r => /ремонт|замен|порч|химчистк|поврежд/i.test(r.what))
          ? `Выявлены повреждения сверх нормального износа, в счёт которых производятся удержания, указанные в соглашении о расторжении.`
          : "Помещение и имущество возвращены в состоянии, в котором были получены, с учётом нормального износа. Претензий к состоянию нет.");
        const m = [["Электроэнергия, кВт·ч", a.m_el], ["Холодная вода, м³", a.m_cold], ["Горячая вода, м³", a.m_hot]];
        N("Показания приборов учёта на день возврата: " + m.map(([l, v]) => `${l.split(",")[0].toLowerCase()} — ${num(v) != null ? String(v).replace(".", ",") : "________"}`).join(", ") + ".");
        N(`Возвращено комплектов ключей: ${F(a.keys, "число")}.`);
        P.push({ text: `Наймодатель ____________ / ${F(U.shortName(a.ll_name), "И. О. Фамилия")}                    Наниматель ____________ / ${F(U.shortName(a.tn_name), "И. О. Фамилия")}`, align: "left", before: 360, keepLines: true });
      };

      if (a.route === "notice") {
        head();
        C.title(P, "УВЕДОМЛЕНИЕ", "о расторжении договора найма");
        T(`Между нами заключён ${contract}.`);
        T(`В соответствии с п. 1 ст. 687 ГК РФ и условиями договора уведомляю о его расторжении. Последний день найма — ${F(U.fmtDate(d.out), "дата выезда")}. В этот день освобожу помещение, верну ключи и имущество.`);
        if (d.shortDays && a.hold_ok === "yes") T(`Установленный договором срок предупреждения (${d.noticeDays} ${C.plural(d.noticeDays, "день", "дня", "дней")}) истекает ${U.fmtDate(d.earliest)}, то есть позже дня выезда на ${d.shortDays} ${C.plural(d.shortDays, "день", "дня", "дней")}. Согласен(на), чтобы плата за эти дни — ${rub(d.hold)} (из расчёта ${U.money(d.daily)} руб. в день) — была удержана из обеспечительного платежа.`);
        T(`Предлагаю в последний день найма подписать акт возврата помещения с показаниями приборов учёта.` + (d.deposit ? ` Прошу вернуть обеспечительный платёж в размере ${rub(d.deposit)}${d.hold ? ` за вычетом ${U.money(d.hold)} руб.` : ""} ${num(a.return_days) === 0 ? "в день выезда" : `не позднее ${F(U.fmtDate(d.returnBy), "дата")}`} (ст. 381.1 ГК РФ).` : ""));
        sign();
      } else if (a.route === "refusal") {
        head();
        C.title(P, "УВЕДОМЛЕНИЕ", "об одностороннем отказе от договора найма");
        T(`Между нами заключён ${contract}.`);
        T(`Вами допущено нарушение условий договора: ${GROUND[a.grounds] || F(null, "нарушение")}. ${F(a.violation, "что произошло")}`.replace(/\s+$/, "").replace(/([^.!?])$/, "$1."));
        T(`На основании п. ${F(a.contract_clause, "пункт")} договора и ст. 450.1 ГК РФ отказываюсь от договора. Договор прекращается ${F(U.fmtDate(d.endByRefusal), "дата")} — по истечении ${F(d.noticeDays, "срок")} ${C.plural(d.noticeDays || 5, "дня", "дней", "дней")} с даты этого уведомления.`);
        T(`Прошу не позднее ${F(U.fmtDate(d.endByRefusal), "дата")} освободить помещение, вернуть ключи и имущество и подписать акт возврата.` + (d.items.length ? ` Задолженность по договору: ${debtList()}, всего ${rub(d.debtSum)}.` : ""));
        if (d.deposit) T(d.toReturn > 0
          ? `Обеспечительный платёж ${rub(d.deposit)}${d.items.length ? ` будет зачтён в погашение задолженности; остаток ${rub(d.toReturn)}` : ""} будет возвращён ${num(a.return_days) === 0 ? "в день возврата помещения" : `не позднее ${F(U.fmtDate(d.returnBy), "дата")}`}.`
          : d.toReturn === 0 ? `Обеспечительный платёж ${rub(d.deposit)} полностью засчитывается в погашение задолженности.`
          : `Обеспечительный платёж ${rub(d.deposit)} засчитывается в погашение задолженности; оставшийся долг ${rub(-d.toReturn)} прошу погасить до указанной даты.`);
        T("Если помещение не будет освобождено добровольно, я обращусь в суд с иском о выселении и взыскании задолженности.");
        sign();
      } else if (a.route === "claim") {
        head();
        C.title(P, "ПРЕДЛОЖЕНИЕ", "о расторжении договора найма");
        T(`Между нами заключён ${contract}.`);
        T(`Вами существенно нарушены условия договора: ${GROUND[a.grounds] || F(null, "нарушение")}. ${F(a.violation, "что произошло")}`.replace(/\s+$/, "").replace(/([^.!?])$/, "$1."));
        T("Предлагаю расторгнуть договор по соглашению сторон и подписать прилагаемое соглашение." + (d.items.length ? ` Задолженность по договору: ${debtList()}, всего ${rub(d.debtSum)}.` : ""));
        T("Прошу ответить в течение 30 дней с момента получения этого предложения. Если вы откажетесь или не ответите, я обращусь в суд с иском о расторжении договора, выселении и взыскании задолженности (п. 2 ст. 452, п. 2 ст. 687 ГК РФ).");
        C.attachments(P, ["Проект соглашения о расторжении договора найма."]);
        sign();
        P.push({ pageBreak: true });
        P.push({ text: "Проект", align: "right", after: 120 });
        agreement(true);
      } else {
        agreement(false);
        returnAct();
      }
      return P;
    },

    guidance(a, d) {
      const g = [];
      if (a.route === "notice") {
        g.push({ title: "Вручите так, чтобы было доказательство.", text: "Лучше всего — под подпись на втором экземпляре. Если договор разрешает уведомления в мессенджере, отправьте туда фото подписанного уведомления и дождитесь ответа; дополнительно — ценным письмом с описью." });
        if (d.shortDays && a.hold_ok !== "yes") g.push({ title: "Срок предупреждения не соблюдён.", text: `Собственник вправе требовать плату за ${d.shortDays} ${C.plural(d.shortDays, "день", "дня", "дней")} до ${U.fmtDate(d.earliest)} — или договоритесь о соглашении о расторжении (вариант «Соглашение» в этом документе).` });
        g.push({ title: "В день выезда подпишите акт возврата.", text: "С показаниями счётчиков и отметкой о состоянии. Снимите квартиру на видео. Без акта спорить о залоге намного сложнее." });
      }
      if (a.route === "agreement") g.push({ title: "Подпишите соглашение и акт в день возврата ключей.", text: "Деньги по залогу — под расписку или переводом с назначением «Возврат обеспечительного платежа по договору найма»." });
      if (a.route === "refusal") g.push({ title: "Отказ работает, только если он есть в договоре.", text: `Проверьте пункт ${a.contract_clause || "о расторжении"}: основания должны быть названы прямо. В найме на год и больше суд может такое условие не применить — тогда используйте вариант «Предложение расторгнуть» и суд.` }, { title: "Не выселяйте самостоятельно.", text: "Менять замки, выносить вещи и отключать свет нельзя даже после окончания договора — это самоуправство (ст. 330 УК, ст. 19.1 КоАП). Если жилец не съезжает, выселение — только через суд." });
      if (a.route === "claim") g.push({ title: "Через 30 дней без ответа — иск.", text: "В районный суд по месту нахождения квартиры: о расторжении договора и выселении (госпошлина 3 000 ₽ — требование неимущественное) и о взыскании долга (пошлина по цене иска — калькулятор К-7). Приложите договор, это предложение и доказательство его отправки." });
      if (d.deposit && a.route !== "claim") g.push({ title: "Залог не вернули в срок?", text: `С ${d.returnBy ? U.fmtDate(U.addDays(d.returnBy, 1)) : "следующего дня после срока"} можно начислять проценты по ст. 395 ГК и направить претензию — документ Д-14.` });
      if (a.long === "yes") g.push({ title: "Погасите запись в ЕГРН.", text: "Договор был зарегистрирован — после расторжения подайте в МФЦ или на Госуслугах соглашение о расторжении или уведомление, чтобы снять обременение." });
      return g;
    },

    reminders(a, d) {
      const ev = [];
      if ((a.route === "notice" || a.route === "agreement") && d.out) ev.push({ date: d.out, title: "Выезд: акт возврата, ключи, показания счётчиков", text: a.address || "" });
      if (a.route === "refusal" && d.endByRefusal) ev.push({ date: d.endByRefusal, title: "Договор найма прекращается — жилец должен освободить квартиру", text: a.address || "" });
      if (d.returnBy && d.deposit && a.route !== "claim") ev.push({ date: d.returnBy, title: "Срок возврата залога за квартиру", text: `${U.money(Math.max(0, d.toReturn - d.hold))} ₽` });
      if (a.route === "claim" && d.date) ev.push({ date: U.addDays(d.date, 30), title: "30 дней на ответ жильца прошли — можно подавать иск", text: "п. 2 ст. 452 ГК РФ. Считайте от даты получения предложения." });
      return ev;
    },

    fileName(a) {
      return ({ notice: "Уведомление о расторжении договора найма", agreement: "Соглашение о расторжении договора найма", refusal: "Уведомление об отказе от договора найма", claim: "Предложение расторгнуть договор найма" }[a.route] || "Расторжение договора найма") + (a.address ? " — " + String(a.address).slice(0, 30) : "");
    },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d67 = spec;
})(typeof window !== "undefined" ? window : globalThis);
