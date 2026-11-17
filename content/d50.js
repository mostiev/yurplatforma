/*
 * Д-50. Жалоба на постановление о штрафе, вынесенное по фото- и видеофиксации (камера).
 * Основа: КоАП РФ — ч. 1 ст. 2.6.1 (ответственность собственника за нарушения, зафиксированные камерой), ч. 2 ст. 2.6.1
 * (собственник освобождается, если в жалобе подтверждено, что автомобиль был во владении другого лица или выбыл из
 * обладания в результате противоправных действий), примечание к ст. 1.5 (собственник доказывает свою невиновность),
 * ст. 30.1, 30.2 (жалоба — вышестоящему должностному лицу или в суд, через орган, вынесший постановление),
 * ч. 1 ст. 30.3 (10 дней со дня вручения или получения копии), ч. 2 ст. 30.3 (восстановление срока),
 * ч. 3, 3.1 ст. 4.8 (срок в днях; окончание в нерабочий день переносится), ч. 1.3 ст. 32.2 (оплата 75% в течение
 * 30 дней со дня вынесения постановления — ред. на 26.07.2026). ППВС № 20 от 25.06.2019 — доказательства владения
 * другим лицом (полис ОСАГО, договор аренды, объяснения). Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;

  const GROUNDS = {
    other_driver: "в момент фиксации транспортное средство находилось во владении и пользовании другого лица",
    sold: "к моменту фиксации транспортное средство было мною продано и передано покупателю",
    stolen: "к моменту фиксации транспортное средство выбыло из моего обладания в результате противоправных действий других лиц (угон, хищение)",
    not_mine: "на фотоматериале зафиксировано не моё транспортное средство (иная марка, модель или цвет; неверно распознан государственный регистрационный знак)",
    no_violation: "правонарушения не было",
  };

  function derive(a) {
    const got = U.date(a.got_date);
    const deadline = got ? C.nextWorkday(U.addDays(got, 10)) : null;
    const late = !!(deadline && U.today() > deadline);
    const decided = U.date(a.decision_date);
    const discountTill = decided ? U.addDays(decided, 30) : null;
    const discountOpen = !!(discountTill && U.today() <= discountTill);
    const sel = (a.grounds || []).filter(k => GROUNDS[k]);
    return { got, deadline, late, decided, discountTill, discountOpen, sel };
  }

  const spec = {
    id: "d50",
    code: "Д-50",
    title: "Жалоба на штраф с камеры",
    lead: "Пришёл штраф с камеры, а за рулём были не вы, машина уже продана или нарушения не было. Жалоба на постановление по КоАП. Займёт около 7 минут.",
    status: "draft",
    actual: "08.11.2026",

    steps: [
      {
        id: "fine", title: "Постановление",
        questions: [
          { id: "resolution", type: "text", label: "Номер постановления (УИН)", hint: "18–25 цифр — в начале постановления", placeholder: "18810177260901234567" },
          { id: "decision_date", type: "date", label: "Дата постановления" },
          { id: "authority", type: "text", label: "Кто вынес постановление", hint: "Как в постановлении", placeholder: "ЦАФАП в ОДД ГИБДД ГУ МВД России по г. Москве" },
          { id: "official", type: "text", label: "Должностное лицо (если указано)", required: false, placeholder: "инспектор Иванов И. И." },
          { id: "article", type: "text", label: "Статья КоАП", placeholder: "ч. 2 ст. 12.9 КоАП РФ" },
          { id: "amount", type: "money", label: "Размер штрафа", suffix: "₽", min: 1 },
          { id: "when", type: "text", label: "Когда и где зафиксировано", placeholder: "15.09.2026 в 14:32, г. Москва, Варшавское ш., д. 100" },
          { id: "plate", type: "text", label: "Госномер автомобиля", placeholder: "А123ВС777" },
          { id: "got_date", type: "date", label: "Когда вы получили копию постановления?", hint: "Письмом, на Госуслугах или в личном кабинете. 10 дней на жалобу считаются с этой даты" },
        ],
      },
      {
        id: "why", title: "Почему не согласны",
        questions: [
          { id: "grounds", type: "multi", label: "Почему штраф незаконный?", options: Object.entries(GROUNDS).map(([value, label]) => ({ value, label: label[0].toUpperCase() + label.slice(1) })) },
          { id: "driver", type: "text", label: "Кто был за рулём", show: a => (a.grounds || []).includes("other_driver"), placeholder: "Сидоров Сидор Сидорович, 01.01.1990 г. р., вписан в полис ОСАГО" },
          { id: "sale_date", type: "date", label: "Дата продажи и передачи машины", show: a => (a.grounds || []).includes("sold") },
          { id: "buyer_car", type: "text", label: "Покупатель", required: false, show: a => (a.grounds || []).includes("sold") },
          { id: "theft", type: "text", label: "Когда и куда заявили об угоне", show: a => (a.grounds || []).includes("stolen"), placeholder: "заявление в ОМВД по району Чертаново 14.09.2026, КУСП № 1234" },
          { id: "desc", type: "textarea", label: "Опишите подробнее", required: false, placeholder: "Знак 3.27 закрыт ветками дерева, фото прилагаю" },
          { id: "proofs", type: "textarea", label: "Какие документы прикладываете?", hint: "Каждый с новой строки. Без доказательств жалобу не удовлетворят",
            placeholder: "Копия полиса ОСАГО с допуском Сидорова С. С.\nОбъяснение Сидорова С. С.\nКопия договора купли-продажи от 01.09.2026" },
          { id: "late_reason", type: "textarea", label: "Почему не подали жалобу в 10 дней?", show: (a, d) => d.late },
          { id: "to", type: "choice", label: "Куда подаёте?", options: [
            { value: "superior", label: "Вышестоящему должностному лицу (начальнику)", hint: "Быстро и бесплатно, можно через Госуслуги" },
            { value: "court", label: "В районный суд", hint: "По месту, где зафиксировано нарушение" },
          ] },
          { id: "court_name", type: "text", label: "Какой суд", show: a => a.to === "court", placeholder: "Чертановский районный суд г. Москвы" },
          { id: "superior_name", type: "text", label: "Кому именно", required: false, show: a => a.to === "superior", placeholder: "Начальнику ЦАФАП в ОДД ГИБДД ГУ МВД России по г. Москве" },
        ],
      },
      {
        id: "you", title: "Вы",
        questions: [
          { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name" },
          { id: "buyer_address", type: "text", label: "Адрес", autocomplete: "street-address" },
          { id: "buyer_phone", type: "tel", label: "Телефон", autocomplete: "tel" },
          { id: "buyer_email", type: "email", label: "Электронная почта", required: false, autocomplete: "email" },
        ],
      },
    ],

    derive,

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      const to = a.to === "court" ? `В ${F(a.court_name, "районный суд")}` : (a.superior_name || `Вышестоящему должностному лицу ${F(a.authority, "орган")}`);
      P.push({ text: to + `\nчерез ${F(a.authority, "орган, вынесший постановление")}`, align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `Заявитель (собственник транспортного средства): ${F(a.buyer_name, "ваши ФИО")}\nАдрес: ${F(a.buyer_address, "адрес")}\nТел.: ${F(a.buyer_phone, "телефон")}` + (a.buyer_email ? `, e-mail: ${a.buyer_email}` : ""), align: "left", leftIndent: 4500, after: 360 });
      C.title(P, "ЖАЛОБА", "на постановление по делу об административном правонарушении");
      T(`Постановлением ${F(a.authority, "орган")}` + (a.official ? ` (${a.official})` : "") + ` № ${F(a.resolution, "номер")} от ${F(U.fmtDate(d.decided), "дата")} я как собственник транспортного средства с государственным регистрационным знаком ${F(a.plate ? String(a.plate).toUpperCase() : null, "госномер")} привлечён(а) к административной ответственности по ${F(a.article, "статья КоАП")} в виде штрафа ${F(U.money(a.amount), "сумма")} руб. Правонарушение зафиксировано работающим в автоматическом режиме специальным техническим средством: ${F(a.when, "когда и где")}. Копию постановления я получил(а) ${F(U.fmtDate(d.got), "дата")}.`);
      T("С постановлением не согласен(на), поскольку " + (d.sel.length ? d.sel.map(k => GROUNDS[k]).join("; ") : F(null, "основание")) + ".");
      if (d.sel.includes("other_driver")) T(`Автомобилем в это время управлял(а) ${F(a.driver, "кто")}. В соответствии с ч. 2 ст. 2.6.1 КоАП РФ собственник освобождается от ответственности, если подтверждено, что в момент фиксации транспортное средство находилось во владении или пользовании другого лица.`);
      if (d.sel.includes("sold")) T(`${F(U.fmtDate(U.date(a.sale_date)), "дата")} транспортное средство продано и передано` + (a.buyer_car ? ` покупателю ${a.buyer_car}` : " покупателю") + " по договору купли-продажи; право собственности перешло к покупателю с момента передачи (п. 1 ст. 223 ГК РФ). На момент фиксации я не являлся(ась) его собственником и владельцем.");
      if (d.sel.includes("stolen")) T(`Об угоне (хищении) заявлено: ${F(a.theft, "куда и когда")}.`);
      if (a.desc) T(String(a.desc).trim());
      T("Согласно примечанию к ст. 1.5 и ч. 2 ст. 2.6.1 КоАП РФ представляю доказательства своей невиновности (прилагаются).");
      if (d.late) T(`Срок подачи жалобы пропущен по уважительной причине: ${F(a.late_reason ? String(a.late_reason).trim().replace(/\.$/, "") : null, "причина")}.`);
      P.push({ text: "На основании ст. 30.1–30.3, 30.7 КоАП РФ", indent: true, keepNext: true });
      P.push({ text: "ПРОШУ:", indent: true, keepNext: true });
      const items = [];
      if (d.late) items.push("Восстановить срок обжалования постановления (ч. 2 ст. 30.3 КоАП РФ).");
      items.push(`Отменить постановление № ${F(a.resolution, "номер")} от ${F(U.fmtDate(d.decided), "дата")}, производство по делу прекратить` + (d.sel.some(k => ["other_driver", "sold", "stolen", "not_mine"].includes(k)) ? " в связи с отсутствием в моих действиях состава административного правонарушения." : "."));
      items.push("Решение по жалобе направить мне по указанному адресу" + (a.buyer_email ? " и по электронной почте." : "."));
      items.forEach((x, i) => T(`${i + 1}. ${x}`));
      C.attachments(P, ["Копия постановления."].concat(String(a.proofs || "").split("\n").map(s => s.trim()).filter(Boolean)));
      C.sign(P, a);
      return P;
    },

    guidance(a, d) {
      const g = [];
      if (!d.late && d.deadline) g.push({ title: `Подайте до ${U.fmtDate(d.deadline)} включительно.`, text: "Это 10 дней со дня получения копии (ч. 1 ст. 30.3 КоАП). Если последний день выпал на выходной, срок переносится на следующий рабочий день." });
      g.push({ title: "Проще всего — через Госуслуги.", text: "В карточке штрафа есть кнопка обжалования: жалобу на штраф с камеры можно подать в электронном виде. Или письмом в орган, вынесший постановление." });
      if (d.discountOpen) g.push({ title: `Скидка 25% действует до ${U.fmtDate(d.discountTill)}.`, text: "Штраф можно оплатить в размере 75% в течение 30 дней со дня вынесения постановления (ч. 1.3 ст. 32.2 КоАП). Жалоба этот срок не продлевает. Если жалобу удовлетворят, оплаченное можно вернуть." });
      if ((a.grounds || []).includes("other_driver")) g.push({ title: "Главное доказательство — кто реально ездил.", text: "Полис ОСАГО с допуском этого водителя, его письменное объяснение, договор аренды. Можно попросить вызвать его для дачи объяснений." });
      g.push({ title: "Решение по жалобе можно обжаловать дальше.", text: "Решение должностного лица — в районный суд, решение районного суда — в областной (краевой) суд в течение 10 дней." });
      return g;
    },

    reminders(a, d) { return [!d.late && { date: d.deadline, title: "Последний день для жалобы на штраф", text: "10 дней с получения копии постановления (ст. 30.3 КоАП)." }, d.discountOpen && { date: d.discountTill, title: "Последний день оплаты штрафа со скидкой 25%", text: "ч. 1.3 ст. 32.2 КоАП." }].filter(Boolean); },

    fileName(a) { return "Жалоба на штраф" + (a.resolution ? " № " + String(a.resolution).slice(-6) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d50 = spec;
})(typeof window !== "undefined" ? window : globalThis);
