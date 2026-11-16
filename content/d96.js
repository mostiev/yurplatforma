/*
 * Д-96. Раздел имущества супругов: проект соглашения для нотариуса или иск о разделе.
 * Основа: СК РФ — ст. 33, 34 (совместная собственность, в том числе доходы, вклады, имущество на имя любого из
 * супругов), ст. 36 (личное: до брака, в дар, по наследству, личные вещи), ст. 38 (раздел в любое время; соглашение —
 * только нотариально, п. 2; давность 3 года для разведённых — п. 7), ст. 39 (доли равны; долги — пропорционально
 * долям, п. 3; компенсация), ст. 45 (личные долги). ГК РФ — ст. 254. ГПК РФ — п. 3 ч. 1 ст. 23 (мировой судья —
 * до 50 000 руб.), ст. 24, 28, ч. 1 ст. 30 (недвижимость — по её месту), ст. 91, 131, 132. НК РФ — пп. 1 п. 1
 * ст. 333.19 (пошлина от цены иска). Пленум ВС РФ
 * от 05.11.1998 № 15 (п. 15–19: что делится, давность — со дня нарушения права, а не развода).
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;
  const num = x => (typeof x === "number" && x > 0 ? x : 0);
  const R = x => U.money(Math.round(x)) + " руб.";
  const REAL = /квартир|дом|участ|комнат|гараж|машино-?мест|недвиж|дач/i;

  function derive(a) {
    const assets = U.rows(a.assets).map(r => ({ what: r.what, value: num(Number(r.value)), to: r.to || "" })).filter(r => r.what);
    const debts = U.rows(a.debts).map(r => ({ what: r.what, value: num(Number(r.value)), to: r.to || "" })).filter(r => r.what);
    const total = assets.reduce((s, x) => s + x.value, 0);
    const mine = assets.filter(x => x.to === "me").reduce((s, x) => s + x.value, 0);
    const theirs = assets.filter(x => x.to === "them").reduce((s, x) => s + x.value, 0);
    const half = total / 2;
    const comp = Math.round(mine - half); // > 0 — я доплачиваю, < 0 — мне доплачивают
    const myDebt = debts.filter(x => x.to === "me").reduce((s, x) => s + x.value, 0);
    const debtTotal = debts.reduce((s, x) => s + x.value, 0);
    const real = assets.some(x => REAL.test(x.what));
    const price = Math.round(half); // цена иска — стоимость доли, которую требует истец
    const fee = C.courtFee(price);
    const mirovoy = price > 0 && price <= 50000;
    const divorced = U.date(a.divorce_date);
    const longAgo = divorced && U.daysBetween(divorced, U.today()) > 3 * 365;
    return { assets, debts, total, mine, theirs, half, comp, myDebt, debtTotal, real, price, fee, mirovoy, court: a.mode === "court", longAgo };
  }

  const TO = [{ value: "me", label: "Мне" }, { value: "them", label: "Супругу" }];

  const spec = {
    id: "d96",
    code: "Д-96",
    title: "Раздел имущества супругов: соглашение или иск",
    lead: "Делим нажитое в браке: квартиру, машину, вклады и кредиты. Посчитаем доли и компенсацию, составим проект соглашения для нотариуса или иск в суд. Займёт около 10 минут.",
    status: "draft",
    actual: "17.11.2026",
    defaults: { mode: "agree" },

    steps: [
      {
        id: "mode", title: "Как делим",
        questions: [
          { id: "mode", type: "choice", label: "Договорились с супругом?", options: [
            { value: "agree", label: "Да — нужен проект соглашения", hint: "Соглашение о разделе действительно только у нотариуса (п. 2 ст. 38 СК). Принесёте готовый проект" },
            { value: "court", label: "Нет — иск в суд" },
          ] },
          { id: "marriage_date", type: "date", label: "Дата регистрации брака" },
          { id: "divorce_date", type: "date", label: "Дата развода", required: false, hint: "Если ещё в браке — оставьте пустым. Делить можно и в браке" },
        ],
      },
      {
        id: "assets", title: "Имущество",
        questions: [
          { id: "assets", type: "rows", label: "Что нажито в браке", hint: "Только общее: купленное в браке на общие деньги, на чьё бы имя ни было оформлено. Подарки, наследство и купленное до брака — не делятся (ст. 36 СК)", max: 20, addLabel: "+ Добавить",
            presets: [{ label: "Квартира", what: "квартира по адресу: " }, { label: "Машина", what: "автомобиль " }, { label: "Вклад", what: "денежные средства на счёте в банке " }],
            columns: [{ id: "what", label: "Что", required: true, w: "3fr", placeholder: "квартира по адресу: г. Москва, ул. Ленина, д. 5, кв. 10" }, { id: "value", label: "Стоимость, ₽", type: "number", required: true, w: "1fr" }, { id: "to", label: "Кому", type: "select", options: TO, required: true, w: "1fr" }] },
          { id: "debts", type: "rows", label: "Общие долги", required: false, hint: "Кредиты, взятые на нужды семьи. Делятся пропорционально долям (п. 3 ст. 39 СК). Личные долги не делятся", max: 10, addLabel: "+ Добавить долг",
            columns: [{ id: "what", label: "Долг", required: true, w: "3fr", placeholder: "ипотека в ПАО «Банк», договор № 1 от 10.01.2022" }, { id: "value", label: "Остаток, ₽", type: "number", required: true, w: "1fr" }, { id: "to", label: "Кто платит дальше", type: "select", options: TO, required: true, w: "1fr" }] },
          { id: "personal", type: "textarea", label: "Что не делится — ваше личное", required: false, placeholder: "автомобиль Kia Rio — подарен мне отцом по договору дарения от 01.03.2021" },
        ],
      },
      {
        id: "parties", title: "Супруги",
        questions: [
          { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name" },
          { id: "buyer_birth", type: "date", label: "Дата рождения" },
          { id: "buyer_birthplace", type: "text", label: "Место рождения", show: a => a.mode === "court", placeholder: "г. Москва" },
          { id: "buyer_id", type: "text", label: a => a.mode === "court" ? "Паспорт, СНИЛС или ИНН — одно на выбор" : "Паспорт: серия, номер, кем и когда выдан", required: a => a.mode === "court" },
          { id: "buyer_address", type: "text", label: "Ваш адрес", autocomplete: "street-address" },
          { id: "buyer_phone", type: "tel", label: "Телефон", autocomplete: "tel", show: a => a.mode === "court" },
          { id: "other_name", type: "text", label: "Супруг(а) — ФИО", placeholder: "Петрова Мария Сергеевна" },
          { id: "other_birth", type: "date", label: "Дата рождения супруга", required: false },
          { id: "other_address", type: "text", label: "Адрес супруга" },
        ],
      },
      {
        id: "court", title: "Суд", show: a => a.mode === "court",
        questions: [
          { id: "why_court", type: "textarea", show: a => a.mode === "court", label: "Почему не удалось договориться", required: false, placeholder: "Ответчик отказывается делить квартиру, проживает в ней один" },
          { id: "court", type: "text", show: a => a.mode === "court", label: (a, d) => d.mirovoy ? "Мировой судья" : "Районный суд", hint: (a, d) => d.real ? "Если делите квартиру, дом или участок — суд по месту нахождения недвижимости (ч. 1 ст. 30 ГПК)" : "По адресу ответчика (ст. 28 ГПК)", placeholder: "Хамовнический районный суд г. Москвы" },
          { id: "court_address", type: "text", show: a => a.mode === "court", label: "Адрес суда", required: false },
        ],
      },
    ],

    derive,

    stop(a, d) {
      if (d.assets.length && !d.total) return { title: "Укажите стоимость имущества.", text: "По ней считаются доли, компенсация и госпошлина." };
      if (d.court && d.longAgo) return { soft: true, title: "После развода прошло больше 3 лет.", text: "Срок давности — 3 года, но считается не от развода, а со дня, когда вы узнали, что ваше право нарушено: например, бывший супруг продал машину или не пускает в квартиру (п. 7 ст. 38 СК, п. 19 Пленума ВС № 15). Если вы пользуетесь имуществом и спора не было — срок, скорее всего, не пропущен." };
      return null;
    },

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      const me = F(a.buyer_name, "ваши ФИО"), other = F(a.other_name, "ФИО супруга");
      const list = arr => arr.map((x, i) => `${i + 1}) ${String(x.what).trim()} — ${R(x.value)}`).join(";\n") + ".";
      const toMe = d.assets.filter(x => x.to === "me"), toThem = d.assets.filter(x => x.to === "them");
      const marr = F(U.fmtDate(U.date(a.marriage_date)), "дата");

      if (!d.court) {
        P.push({ text: "ПРОЕКТ — для нотариального удостоверения (п. 2 ст. 38 СК РФ)", align: "left", after: 240 });
        C.title(P, "СОГЛАШЕНИЕ", "о разделе общего имущества супругов");
        P.push({ text: `г. ____________                                                   «___» ____________ 20__ г.`, align: "left", after: 240 });
        T(`${me}, ${F(U.fmtDate(U.date(a.buyer_birth)), "дата")} г. р., ${F(a.buyer_id, "паспорт")}, зарегистрированный(ая) по адресу: ${F(a.buyer_address, "адрес")}, и ${other}` + (U.date(a.other_birth) ? `, ${U.fmtDate(U.date(a.other_birth))} г. р.` : "") + `, зарегистрированный(ая) по адресу: ${F(a.other_address, "адрес")}, состоящие (состоявшие) в браке с ${marr}` + (U.date(a.divorce_date) ? `, расторгнутом ${U.fmtDate(U.date(a.divorce_date))}` : "") + `, руководствуясь ст. 38, 39 Семейного кодекса РФ, заключили настоящее соглашение.`);
        T(`1. В период брака супругами нажито общее имущество общей стоимостью ${R(d.total)}:\n${list(d.assets)}`);
        T(`2. В собственность ${me} переходит:\n${toMe.length ? list(toMe) : "—"}`);
        T(`3. В собственность ${other} переходит:\n${toThem.length ? list(toThem) : "—"}`);
        if (Math.abs(d.comp) >= 1) T(`4. За превышение стоимости полученного имущества над стоимостью доли выплачивается денежная компенсация в размере ${R(Math.abs(d.comp))}. Плательщик — ${d.comp > 0 ? me : other}, получатель — ${d.comp > 0 ? other : me}. Срок выплаты — до «___» ____________ 20__ г.`);
        let n = Math.abs(d.comp) >= 1 ? 5 : 4;
        if (d.debts.length) T(`${n++}. Общие обязательства супругов распределяются так: ` + d.debts.map(x => `${String(x.what).trim()} (остаток ${R(x.value)}) — исполняет ${x.to === "me" ? me : other}`).join("; ") + ". Это соглашение не изменяет обязательств перед кредитором без его согласия (ст. 391 ГК РФ).");
        if (a.personal) T(`${n++}. Стороны подтверждают, что следующее имущество является личным и разделу не подлежит (ст. 36 СК РФ): ${String(a.personal).trim().replace(/\.$/, "")}.`);
        T(`${n++}. Имущество, которое будет приобретено каждым из супругов после подписания соглашения, является его собственностью${U.date(a.divorce_date) ? "" : ", если супруги не договорятся иначе"}.`);
        T(`${n++}. Право собственности на недвижимое имущество возникает с момента государственной регистрации. Нотариус подаёт документы на регистрацию.`);
        T(`${n++}. Соглашение составлено в трёх экземплярах: по одному для каждой стороны и для нотариуса.`);
        P.push({ text: `Подписи:\n\n____________ / ${F(U.shortName(a.buyer_name), "И. О. Фамилия")}\n\n____________ / ${F(U.shortName(a.other_name), "И. О. Фамилия")}`, align: "left", before: 360 });
        return P;
      }

      P.push({ text: `В ${F(a.court, "суд")}` + (a.court_address ? `\nАдрес: ${a.court_address}` : ""), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `Истец: ${me}\nдата и место рождения: ${F(U.fmtDate(U.date(a.buyer_birth)), "дата")}, ${F(a.buyer_birthplace, "место")}\n${F(a.buyer_id, "паспорт, СНИЛС или ИНН")}\nадрес: ${F(a.buyer_address, "адрес")}\nтел.: ${F(a.buyer_phone, "телефон")}`, align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `Ответчик: ${other}\nадрес: ${F(a.other_address, "адрес")}`, align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `Цена иска: ${R(d.price)}\nГосударственная пошлина: ${R(d.fee)}`, align: "left", leftIndent: 4500, after: 360 });
      C.title(P, "ИСКОВОЕ ЗАЯВЛЕНИЕ", "о разделе совместно нажитого имущества супругов");
      T(`С ${marr} я состою (состоял(а)) в браке с ответчиком` + (U.date(a.divorce_date) ? `; брак расторгнут ${U.fmtDate(U.date(a.divorce_date))}` : "") + `. В период брака нами нажито общее имущество общей стоимостью ${R(d.total)}:\n${list(d.assets)}`);
      T("Имущество, нажитое супругами во время брака, является их совместной собственностью независимо от того, на имя кого из супругов оно приобретено (ст. 34 СК РФ). При разделе доли супругов признаются равными (п. 1 ст. 39 СК РФ).");
      if (a.why_court) T(`Соглашение о разделе не достигнуто: ${String(a.why_court).trim().replace(/\.$/, "")}.`);
      T(`Стоимость моей доли — ${R(d.half)}. Предлагаю передать мне: ${toMe.length ? toMe.map(x => String(x.what).trim()).join("; ") : "—"} (на сумму ${R(d.mine)}); ответчику: ${toThem.length ? toThem.map(x => String(x.what).trim()).join("; ") : "—"} (на сумму ${R(d.theirs)}).` + (Math.abs(d.comp) >= 1 ? ` Разница компенсируется деньгами: ${d.comp > 0 ? "я выплачиваю ответчику" : "ответчик выплачивает мне"} ${R(Math.abs(d.comp))} (абз. 2 п. 3 ст. 38 СК РФ).` : ""));
      if (d.debts.length) T(`Общие долги супругов распределяются пропорционально присуждённым долям (п. 3 ст. 39 СК РФ): ${d.debts.map(x => `${String(x.what).trim()} — остаток ${R(x.value)}`).join("; ")}.` + (d.myDebt ? ` После раздела я продолжаю погашать ${R(d.myDebt)}, поэтому половину платежей, внесённых мной после прекращения семейных отношений, прошу учесть при расчёте компенсации.` : ""));
      if (a.personal) T(`Не подлежит разделу как моё личное имущество (ст. 36 СК РФ): ${String(a.personal).trim().replace(/\.$/, "")}.`);
      if (d.real) T("Иск подаётся по месту нахождения недвижимого имущества (ч. 1 ст. 30 ГПК РФ).");
      P.push({ text: "На основании ст. 34, 38, 39 СК РФ, ст. 254 ГК РФ, ст. 131, 132 ГПК РФ", indent: true, keepNext: true });
      P.push({ text: "ПРОШУ:", indent: true, keepNext: true });
      const ask = [`Произвести раздел общего имущества супругов, признав доли равными.`];
      if (toMe.length) ask.push(`Признать за мной право собственности на: ${toMe.map(x => String(x.what).trim()).join("; ")}.`);
      if (toThem.length) ask.push(`Передать в собственность ответчика: ${toThem.map(x => String(x.what).trim()).join("; ")}.`);
      if (d.comp < -1) ask.push(`Взыскать с ответчика в мою пользу компенсацию стоимости доли ${R(-d.comp)}.`);
      if (d.comp > 1) ask.push(`Определить компенсацию, причитающуюся ответчику, в размере ${R(d.comp)}.`);
      if (d.debts.length) ask.push("Распределить общие долги супругов пропорционально присуждённым долям.");
      ask.push(`Взыскать с ответчика расходы по уплате государственной пошлины.`);
      ask.forEach((x, i) => T(`${i + 1}. ${x}`));
      C.attachments(P, [
        `Документ об уплате государственной пошлины (${R(d.fee)}).`,
        "Документ, подтверждающий направление ответчику копии иска с приложениями (п. 6 ст. 132 ГПК РФ).",
        "Копия свидетельства о заключении брака" + (U.date(a.divorce_date) ? " и свидетельства о расторжении брака." : "."),
        "Документы на имущество: выписки ЕГРН, ПТС или СТС, договоры, выписки по счетам.",
        "Документы о стоимости имущества: отчёт оценщика, объявления о продаже аналогов.",
        ...(d.debts.length ? ["Кредитные договоры и справки об остатке долга."] : []),
      ]);
      C.sign(P, a);
      return P;
    },

    guidance(a, d) {
      const g = [];
      if (!d.court) {
        g.push({ title: "Идите к нотариусу вдвоём с проектом и документами.", text: "Без нотариуса соглашение о разделе ничтожно (п. 2 ст. 38 СК). Нотариус проверит документы, удостоверит соглашение и сам подаст его на регистрацию в Росреестр. Тариф зависит от стоимости имущества — спросите у нотариуса заранее; плюс услуги правового и технического характера." });
        g.push({ title: "Возьмите документы.", text: "Паспорта, свидетельство о браке (о разводе), выписки ЕГРН, ПТС и СТС, договоры покупки, справки банка об остатке кредита." });
        g.push({ title: "Кредит не переходит на одного без согласия банка.", text: "Если делите ипотеку или автокредит — согласуйте с банком заранее. Для банка оба супруга остаются должниками, пока он не согласился." });
        return g;
      }
      g.push({ title: `Заплатите госпошлину ${R(d.fee)}.`, text: "Она считается от стоимости доли, которую вы просите. Суд может распределить расходы между сторонами." });
      g.push({ title: "Оцените имущество.", text: "Ответчик может оспорить стоимость — тогда суд назначит экспертизу. Отчёт оценщика или распечатки объявлений об аналогах помогут." });
      g.push({ title: "Попросите арест имущества, если боитесь, что его продадут.", text: "Ходатайство об обеспечении иска (ст. 139, 140 ГПК): запрет регистрационных действий с квартирой или машиной." });
      return g;
    },

    fileName(a) { return a.mode === "court" ? "Иск о разделе имущества супругов" : "Проект соглашения о разделе имущества"; },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d96 = spec;
})(typeof window !== "undefined" ? window : globalThis);
