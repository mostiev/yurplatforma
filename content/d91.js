/*
 * Д-91. Исковое заявление о защите прав потребителя (товар, работа, услуга).
 * Основа: Закон РФ от 07.02.1992 № 2300-1 «О защите прав потребителей» — п. 2, 3 ст. 17 (подсудность по выбору
 * истца, освобождение от госпошлины), ст. 13 п. 6 (штраф 50%; п. 7, 8 — исключения, ред. 500-ФЗ с 01.02.2026),
 * ст. 15 (моральный вред), ст. 18, 22, 23 (товар), ст. 28, 29, 31 (работы и услуги), п. 1 ст. 23 и п. 5 ст. 28
 * (пределы неустойки). ГПК РФ — ст. 23 (мировой судья — по спорам о защите прав потребителей до 100 000 руб.),
 * ст. 24, ч. 7 ст. 29, ст. 91 (цена иска), ст. 131, 132 (содержание иска, идентификаторы, направление копии
 * ответчику). НК РФ — пп. 4 п. 2, п. 3 ст. 333.36 (до 1 млн руб. — без пошлины, свыше — разница), ст. 333.19.
 * Пленум ВС РФ от 28.06.2012 № 17 (п. 22, 45, 46), от 24.03.2016 № 7 (п. 65 — неустойка по день исполнения).
 * Финансовые организации — Федеральный закон от 04.06.2018 № 123-ФЗ (ст. 15, 25: сначала финансовый
 * уполномоченный по требованиям до 500 000 руб.).
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;
  const num = x => (typeof x === "number" && x > 0 ? x : 0);
  const R = x => U.money(x) + " руб.";

  const CLAIMS = {
    refund: "Вернуть деньги, уплаченные по договору",
    reduce: "Уменьшить цену (вернуть часть денег)",
    losses: "Возместить убытки",
    penalty: "Неустойка за просрочку",
    moral: "Компенсация морального вреда",
    costs: "Судебные расходы: экспертиза, юрист, почта",
  };
  const VENUE = {
    me: "по месту моего жительства (пребывания)",
    them: "по адресу ответчика",
    deal: "по месту заключения или исполнения договора",
  };

  function derive(a) {
    const c = a.claims || [];
    const has = k => c.includes(k);
    const refund = has("refund") ? num(a.refund_amount) : 0;
    const reduce = has("reduce") ? num(a.reduce_amount) : 0;
    const losses = has("losses") ? num(a.losses_amount) : 0;
    const penalty = has("penalty") ? num(a.penalty_amount) : 0;
    const moral = has("moral") ? num(a.moral_amount) : 0;
    const costs = has("costs") ? num(a.costs_amount) : 0;
    const price = refund + reduce + losses + penalty; // цена иска: моральный вред, штраф и расходы не входят (ст. 91 ГПК)
    const mirovoy = price > 0 && price <= 100000;
    const fee = price > 1000000 ? C.courtFee(price) - C.courtFee(1000000) : 0;
    const rate = { r1: 1, r3: 3, r05: 0.5 }[a.penalty_rate] || 0;
    const penaltyCap = rate === 1 ? num(a.paid) || num(a.price) : rate === 3 ? num(a.price) : rate === 0.5 ? num(a.paid) : 0;
    const fin = a.defendant_fin === "yes";
    return { refund, reduce, losses, penalty, moral, costs, price, mirovoy, fee, rate, penaltyCap, fin, has };
  }

  const spec = {
    id: "d91",
    code: "Д-91",
    title: "Иск о защите прав потребителя",
    lead: "Магазин, исполнитель или сервис не выполнили претензию — подаём в суд. Вернуть деньги, неустойка, моральный вред и штраф 50%. До 1 млн ₽ госпошлину платить не нужно. Займёт около 10 минут.",
    status: "draft",
    actual: "17.11.2026",
    defaults: { subject: "goods", seller_kind: "org", defendant_fin: "no", claim_sent: "yes", venue: "me" },

    steps: [
      {
        id: "deal", title: "Покупка",
        questions: [
          { id: "subject", type: "choice", label: "Что покупали?", options: [
            { value: "goods", label: "Товар" },
            { value: "work", label: "Работу", hint: "Ремонт, пошив, установка — когда результат можно потрогать" },
            { value: "service", label: "Услугу", hint: "Обучение, связь, туризм, медицина, фитнес" },
          ] },
          { id: "product", type: "text", label: a => a.subject === "goods" ? "Что купили" : "Какую работу или услугу заказали", placeholder: a => a.subject === "goods" ? "смартфон Samsung Galaxy S25, серийный № R5CX…" : "ремонт ванной комнаты по договору № 15" },
          { id: "contract_date", type: "date", label: "Дата покупки или договора" },
          { id: "price", type: "money", label: "Цена по договору", suffix: "₽" },
          { id: "paid", type: "money", label: "Сколько вы заплатили", suffix: "₽", required: false, hint: "Если меньше цены — например, предоплата" },
          { id: "seller_kind", type: "choice", label: "Кто продавец или исполнитель?", options: [
            { value: "org", label: "Компания" }, { value: "ip", label: "ИП" }, { value: "self", label: "Самозанятый" }, { value: "person", label: "Частное лицо без статуса" },
          ] },
          { id: "defendant_fin", type: "choice", label: "Это банк, страховая или микрофинансовая организация?", show: a => a.seller_kind === "org", options: [
            { value: "no", label: "Нет" }, { value: "yes", label: "Да" },
          ] },
          { id: "ombudsman", type: "choice", label: "Вы уже обращались к финансовому уполномоченному?", show: a => a.defendant_fin === "yes" && a.seller_kind === "org", options: [
            { value: "done", label: "Да, есть решение или он отказал" }, { value: "no", label: "Нет" },
          ] },
          { id: "ombudsman_desc", type: "text", label: "Решение финансового уполномоченного: номер и дата", show: a => a.ombudsman === "done" && a.defendant_fin === "yes", required: false, placeholder: "№ У-26-123456/5010-003 от 10.10.2026" },
          { id: "seller_name", type: "text", label: "Ответчик: название или ФИО", placeholder: "ООО «Электросила»" },
          C.innQuestion("seller_inn", "ИНН ответчика"),
          { id: "seller_ogrn", type: "text", label: "ОГРН или ОГРНИП", required: false, hint: "Если знаете — есть в чеке, договоре или выписке ЕГРЮЛ" },
          { id: "seller_address", type: "text", label: "Адрес ответчика", hint: "Юридический адрес из ЕГРЮЛ или адрес ИП" },
        ],
      },
      {
        id: "problem", title: "Что случилось",
        questions: [
          { id: "violation", type: "textarea", label: "Что не так", hint: "Факты и даты: что обнаружили, когда, что говорил продавец. Ссылки на документы",
            placeholder: a => a.subject === "goods" ? "Через 2 месяца после покупки смартфон перестал заряжаться. 05.09.2026 сдал(а) его на проверку качества, продавец признал недостаток (акт № 12)." : "Работы по договору нужно было закончить до 01.08.2026. На 15.10.2026 они не завершены, плитка уложена с перепадами до 5 мм." },
          { id: "claim_sent", type: "choice", label: "Вы отправляли претензию?", options: [
            { value: "yes", label: "Да" }, { value: "no", label: "Нет" },
          ] },
          { id: "claim_date", type: "date", label: "Когда претензию получили или вручили", show: a => a.claim_sent === "yes" },
          { id: "claim_demand", type: "text", label: "Что требовали в претензии", show: a => a.claim_sent === "yes", placeholder: "вернуть 89 990 руб. за товар" },
          { id: "claim_result", type: "choice", label: "Что ответили?", show: a => a.claim_sent === "yes", options: [
            { value: "silent", label: "Ничего — не ответили" }, { value: "refused", label: "Отказали" }, { value: "partly", label: "Выполнили частично" },
          ] },
          { id: "claim_answer", type: "text", label: "Коротко: ответ", show: a => a.claim_sent === "yes" && a.claim_result !== "silent", required: false, placeholder: "письмом от 20.09.2026 отказали, сославшись на нарушение правил эксплуатации" },
        ],
      },
      {
        id: "claims", title: "Требования",
        questions: [
          { id: "claims", type: "multi", label: "Что требуете через суд?", hint: "Требования, которых не было в претензии, тоже можно заявить. Штраф 50% суд взыщет сам — мы его тоже попросим",
            options: Object.entries(CLAIMS).map(([value, label]) => ({ value, label })) },
          { id: "refund_amount", type: "money", label: "Сколько вернуть", suffix: "₽", show: a => (a.claims || []).includes("refund") },
          { id: "goods_back", type: "choice", label: "Товар у вас?", show: a => (a.claims || []).includes("refund") && a.subject === "goods", options: [
            { value: "me", label: "Да, верну продавцу по его требованию" }, { value: "them", label: "Нет, он уже у продавца" },
          ] },
          { id: "reduce_amount", type: "money", label: "На сколько уменьшить цену", suffix: "₽", show: a => (a.claims || []).includes("reduce") },
          { id: "losses_amount", type: "money", label: "Сумма убытков", suffix: "₽", show: a => (a.claims || []).includes("losses") },
          { id: "losses_desc", type: "text", label: "Из чего состоят убытки", show: a => (a.claims || []).includes("losses"), placeholder: "разница в цене аналогичного товара, переделка работ другим мастером" },
          { id: "penalty_rate", type: "select", label: "Какая неустойка", show: a => (a.claims || []).includes("penalty"), options: [
            { value: "r1", label: "1% в день — товар: возврат денег, замена, ремонт (ст. 23)" },
            { value: "r3", label: "3% в день — работа или услуга (ст. 28, 31)" },
            { value: "r05", label: "0,5% в день — не передали предоплаченный товар (ст. 23.1)" },
          ] },
          { id: "penalty_amount", type: "money", label: "Неустойка на сегодня", suffix: "₽", show: a => (a.claims || []).includes("penalty"), hint: "Посчитайте в калькуляторе неустойки К-1 и перенесите сумму" },
          { id: "penalty_from", type: "date", label: "С какого дня начисляется неустойка", show: a => (a.claims || []).includes("penalty") },
          { id: "penalty_base", type: "money", label: "От какой суммы считается", suffix: "₽", show: a => (a.claims || []).includes("penalty"), hint: "Обычно цена товара или работы" },
          { id: "moral_amount", type: "money", label: "Компенсация морального вреда", suffix: "₽", show: a => (a.claims || []).includes("moral"), hint: "Суды по потребительским спорам чаще присуждают от 3 000 до 20 000 ₽. Больше — если пострадало здоровье или нарушение серьёзное" },
          { id: "moral_why", type: "text", label: "Почему именно столько", show: a => (a.claims || []).includes("moral"), required: false, placeholder: "три месяца без телефона, нужен для работы" },
          { id: "costs_amount", type: "money", label: "Судебные расходы", suffix: "₽", show: a => (a.claims || []).includes("costs") },
          { id: "costs_desc", type: "text", label: "Из чего состоят", show: a => (a.claims || []).includes("costs"), placeholder: "экспертиза — 12 000 руб., почта — 540 руб." },
        ],
      },
      {
        id: "court", title: "Суд",
        questions: [
          { id: "venue", type: "choice", label: "Куда подаёте?", hint: "Потребитель выбирает суд сам (п. 2 ст. 17 Закона, ч. 7 ст. 29 ГПК)", options: [
            { value: "me", label: "Рядом с домом", hint: "По месту жительства или пребывания — удобнее всего" },
            { value: "them", label: "По адресу ответчика" },
            { value: "deal", label: "Где заключили или исполняли договор" },
          ] },
          { id: "court", type: "text", label: (a, d) => d.mirovoy ? "Судебный участок мирового судьи" : "Районный суд", hint: (a, d) => d.price ? (d.mirovoy ? `Цена иска ${R(d.price)} — до 100 000 ₽ иск рассматривает мировой судья (п. 5 ч. 1 ст. 23 ГПК). Найдите участок по адресу на сайте мировых судей вашего региона` : `Цена иска ${R(d.price)} — больше 100 000 ₽, иск в районный (городской) суд`) : "Сначала укажите суммы требований",
            placeholder: (a, d) => d.mirovoy ? "Мировой судья судебного участка № 158 района Хамовники г. Москвы" : "Хамовнический районный суд г. Москвы" },
          { id: "court_address", type: "text", label: "Адрес суда", required: false },
        ],
      },
      {
        id: "you", title: "Вы",
        questions: [
          { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name" },
          { id: "buyer_birth", type: "date", label: "Дата рождения" },
          { id: "buyer_birthplace", type: "text", label: "Место рождения", placeholder: "г. Москва" },
          { id: "buyer_id", type: "text", label: "Паспорт, СНИЛС или ИНН — одно на выбор", hint: "Суд требует один идентификатор истца (п. 2 ч. 2 ст. 131 ГПК)", placeholder: "СНИЛС 123-456-789 00" },
          { id: "buyer_address", type: "text", label: "Адрес жительства", autocomplete: "street-address" },
          { id: "buyer_phone", type: "tel", label: "Телефон", autocomplete: "tel" },
          { id: "buyer_email", type: "email", label: "Электронная почта", required: false, autocomplete: "email" },
        ],
      },
    ],

    derive,

    stop(a, d) {
      if (a.seller_kind === "person") return { title: "Закон о защите прав потребителей здесь не действует.", text: "Если продавец или мастер — частное лицо без статуса ИП и не занимается этим постоянно, спор решается по Гражданскому кодексу: без штрафа 50% и с госпошлиной. Начните с претензии по ГК.", link: { href: "d85.html", text: "Претензия частному продавцу или мастеру →" } };
      if (d.fin && a.ombudsman !== "done" && d.price <= 500000) return { title: "Сначала — финансовый уполномоченный.", text: "По требованиям к банку, страховой или МФО до 500 000 ₽ суд примет иск только после обращения к финансовому уполномоченному (ст. 15, 25 закона № 123-ФЗ). Обращение бесплатное, подаётся на сайте finombudsman.ru или через Госуслуги, ответ — за 15 рабочих дней. Перед этим нужна претензия в саму организацию (она отвечает за 15 рабочих дней). Если уполномоченный откажет или вы не согласитесь с решением — вернитесь сюда.", link: { href: "d52.html", text: "Жалоба в Банк России →" } };
      if (a.claim_sent === "no") return { soft: true, title: "Лучше сначала претензию.", text: "Закон не требует претензии перед иском потребителя. Но без неё ответчик скажет, что не знал о требовании и не мог выполнить его добровольно, и попросит не взыскивать штраф 50% (п. 7 ст. 13 Закона в ред. 500-ФЗ). Претензия — 10 дней ожидания, а иск станет сильнее.", link: { href: "../index.html", text: "Выбрать претензию →" } };
      return null;
    },

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      const subj = a.subject === "goods" ? "товар" : a.subject === "work" ? "работа" : "услуга";
      const kindWord = { org: "", ip: "ИП ", self: "", person: "" }[a.seller_kind] || "";
      const sellerTitle = a.subject === "goods" ? "продавца" : "исполнителя";

      P.push({ text: `В ${F(a.court, "суд")}` + (a.court_address ? `\nАдрес: ${a.court_address}` : ""), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `Истец: ${F(a.buyer_name, "ваши ФИО")}\nдата и место рождения: ${F(U.fmtDate(U.date(a.buyer_birth)), "дата")}, ${F(a.buyer_birthplace, "место")}\n${F(a.buyer_id, "паспорт, СНИЛС или ИНН")}\nадрес: ${F(a.buyer_address, "адрес")}\nтел.: ${F(a.buyer_phone, "телефон")}` + (a.buyer_email ? `, e-mail: ${a.buyer_email}` : ""), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `Ответчик: ${kindWord}${F(a.seller_name, "ответчик")}` + (a.seller_inn ? `\nИНН ${a.seller_inn}` : "") + (a.seller_ogrn ? `, ${a.seller_kind === "ip" ? "ОГРНИП" : "ОГРН"} ${a.seller_ogrn}` : "") + `\nадрес: ${F(a.seller_address, "адрес ответчика")}`, align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `Цена иска: ${F(d.price ? R(d.price) : null, "сумма")}\n` + (d.fee ? `Государственная пошлина: ${R(d.fee)} (с цены иска свыше 1 000 000 руб., п. 3 ст. 333.36 НК РФ)` : "Государственная пошлина: истец освобождён (п. 3 ст. 17 Закона РФ «О защите прав потребителей», пп. 4 п. 2 ст. 333.36 НК РФ)"), align: "left", leftIndent: 4500, after: 360 });

      C.title(P, "ИСКОВОЕ ЗАЯВЛЕНИЕ", "о защите прав потребителя");
      const paidTxt = num(a.paid) && num(a.paid) !== num(a.price) ? `, из которых я оплатил(а) ${R(num(a.paid))}` : ", которые я оплатил(а) полностью";
      T(`${F(U.fmtDate(U.date(a.contract_date)), "дата")} я ${a.subject === "goods" ? "купил(а) у ответчика товар" : "заключил(а) с ответчиком договор"}: ${F(a.product ? String(a.product).trim() : null, "что купили")}. Цена — ${F(num(a.price) ? R(num(a.price)) : null, "цена")}${paidTxt}. ${a.subject === "goods" ? "Товар приобретён" : (a.subject === "work" ? "Работа заказана" : "Услуга заказана")} для личных нужд, не связанных с предпринимательской деятельностью, поэтому к отношениям сторон применяется Закон РФ «О защите прав потребителей».`);
      T(F(a.violation ? String(a.violation).trim() : null, "что случилось"));
      if (a.claim_sent === "yes") {
        const res = { silent: "Ответчик на претензию не ответил", refused: "Ответчик отказал" + (a.claim_answer ? `: ${String(a.claim_answer).trim().replace(/\.$/, "")}` : ""), partly: "Ответчик выполнил требование лишь частично" + (a.claim_answer ? `: ${String(a.claim_answer).trim().replace(/\.$/, "")}` : "") }[a.claim_result] || F(null, "ответ");
        T(`${F(U.fmtDate(U.date(a.claim_date)), "дата")} ответчик получил мою претензию с требованием ${F(a.claim_demand ? String(a.claim_demand).trim().replace(/\.$/, "") : null, "требование")}. ${res}. В добровольном порядке мои требования не удовлетворены.`);
      }
      const law = a.subject === "goods" ? "ст. 18, 22, 23" : "ст. 28, 29, 31";
      if (d.has("refund") || d.has("reduce")) T(`В соответствии со ${law} Закона РФ «О защите прав потребителей» я вправе потребовать ${[d.has("refund") ? "возврата уплаченной суммы" : null, d.has("reduce") ? "соразмерного уменьшения цены" : null].filter(Boolean).join(" и ")}` + (d.has("refund") && a.subject === "goods" && a.goods_back === "me" ? ". Товар я готов(а) возвратить ответчику по его требованию и за его счёт (абз. 6 п. 1 ст. 18 Закона)." : "."));
      if (d.has("losses")) T(`Нарушением моих прав мне причинены убытки ${R(d.losses)}` + (a.losses_desc ? `: ${String(a.losses_desc).trim().replace(/\.$/, "")}` : "") + ". Убытки подлежат возмещению в полной сумме сверх неустойки (ст. 13 Закона, ст. 15 ГК РФ).");
      if (d.has("penalty")) {
        const art = { 1: "п. 1 ст. 23", 3: "п. 5 ст. 28, п. 3 ст. 31", 0.5: "п. 3 ст. 23.1" }[d.rate] || "";
        T(`За нарушение сроков ответчик обязан уплатить неустойку ${String(d.rate).replace(".", ",")}% от ${F(num(a.penalty_base) ? R(num(a.penalty_base)) : null, "суммы")} за каждый день просрочки (${art} Закона). С ${F(U.fmtDate(U.date(a.penalty_from)), "дата")} по день подачи иска она составляет ${R(d.penalty)}; расчёт прилагается. Неустойка подлежит взысканию и за период после вынесения решения — по день фактического исполнения обязательства (п. 65 постановления Пленума Верховного Суда РФ от 24.03.2016 № 7)` + (d.penaltyCap ? `, но всего не более ${R(d.penaltyCap)}` : "") + ".");
      }
      if (d.has("moral")) T(`Нарушением моих прав как потребителя мне причинён моральный вред, который я оцениваю в ${R(d.moral)}` + (a.moral_why ? `: ${String(a.moral_why).trim().replace(/\.$/, "")}` : "") + ". Для компенсации достаточно установленного факта нарушения прав потребителя (ст. 15 Закона, п. 45 постановления Пленума Верховного Суда РФ от 28.06.2012 № 17).");
      T("Поскольку требования не удовлетворены добровольно, суд взыскивает с ответчика штраф в размере 50% от присуждённой суммы (п. 6 ст. 13 Закона, п. 46 постановления Пленума Верховного Суда РФ от 28.06.2012 № 17).");
      if (d.fin && a.ombudsman === "done") T(`Обязательный досудебный порядок соблюдён: я обращался(ась) к финансовому уполномоченному` + (a.ombudsman_desc ? ` (${String(a.ombudsman_desc).trim()})` : "") + " (ст. 25 Федерального закона от 04.06.2018 № 123-ФЗ).");
      T(`Иск подаётся ${VENUE[a.venue] || VENUE.me} (п. 2 ст. 17 Закона, ч. 7 ст. 29 ГПК РФ)` + (d.mirovoy ? "; цена иска не превышает 100 000 руб. (п. 5 ч. 1 ст. 23 ГПК РФ)." : "."));

      P.push({ text: "На основании изложенного, руководствуясь ст. 13, 15, 17 Закона РФ «О защите прав потребителей», ст. 131, 132 ГПК РФ,", indent: true, keepNext: true });
      P.push({ text: "ПРОШУ:", indent: true, keepNext: true });
      const ask = [];
      const who = `с ${F(a.seller_name, "ответчика")} в мою пользу`;
      if (d.has("refund")) ask.push(`Взыскать ${who} уплаченные по договору ${R(d.refund)}.`);
      if (d.has("reduce")) ask.push(`Взыскать ${who} ${R(d.reduce)} в счёт уменьшения цены.`);
      if (d.has("losses")) ask.push(`Взыскать ${who} убытки ${R(d.losses)}.`);
      if (d.has("penalty")) ask.push(`Взыскать ${who} неустойку за период с ${F(U.fmtDate(U.date(a.penalty_from)), "дата")} по день подачи иска ${R(d.penalty)}, а также неустойку ${String(d.rate).replace(".", ",")}% от ${F(num(a.penalty_base) ? R(num(a.penalty_base)) : null, "суммы")} за каждый день со дня, следующего за днём подачи иска, по день фактического исполнения обязательства` + (d.penaltyCap ? `, а всего неустойки — не более ${R(d.penaltyCap)}` : "") + ".");
      if (d.has("moral")) ask.push(`Взыскать ${who} компенсацию морального вреда ${R(d.moral)}.`);
      ask.push(`Взыскать ${who} штраф в размере 50% от суммы, присуждённой судом.`);
      if (d.has("costs")) ask.push(`Взыскать ${who} судебные расходы ${R(d.costs)}` + (a.costs_desc ? ` (${String(a.costs_desc).trim().replace(/\.$/, "")})` : "") + ".");
      ask.forEach((x, i) => T(`${i + 1}. ${x}`));
      P.forEach(p => { if (p.text) p.text = p.text.replace(/руб\.\./g, "руб."); });

      const att = [
        `Документ, подтверждающий направление ответчику копии искового заявления и приложений (п. 6 ст. 132 ГПК РФ).`,
        a.subject === "goods" ? "Кассовый чек (договор, выписка по карте)." : "Договор, документы об оплате.",
      ];
      if (a.claim_sent === "yes") att.push("Претензия и документ о её вручении или отправке.");
      if (a.claim_sent === "yes" && a.claim_result !== "silent") att.push("Ответ ответчика на претензию.");
      att.push("Доказательства недостатка или нарушения (акт, заключение, фото, переписка).");
      if (d.has("penalty")) att.push("Расчёт неустойки.");
      if (d.has("losses") || d.has("costs")) att.push("Документы, подтверждающие убытки и расходы.");
      if (d.fin && a.ombudsman === "done") att.push("Решение финансового уполномоченного.");
      if (d.fee) att.push(`Документ об уплате государственной пошлины (${R(d.fee)}).`);
      C.attachments(P, att);
      C.sign(P, a);
      P.forEach(p => { if (p.text) p.text = p.text.replace(/руб\.\./g, "руб."); });
      return P;
    },

    guidance(a, d) {
      const g = [];
      g.push({ title: "Сначала отправьте ответчику копию иска.", text: "Заказным письмом с описью вложения или вручите под подпись. Квитанцию и опись приложите к иску — без этого суд оставит иск без движения (п. 6 ст. 132 ГПК)." });
      g.push({ title: d.mirovoy ? "Подайте мировому судье." : "Подайте в районный суд.", text: "Лично в канцелярию (на втором экземпляре поставят отметку), по почте или через ГАС «Правосудие» со входом через Госуслуги. Приложите копии документов, оригиналы возьмите на заседание." + (d.fee ? ` Госпошлина — ${R(d.fee)}: с цены иска свыше 1 млн ₽ потребитель платит разницу.` : " Госпошлину платить не нужно.") });
      g.push({ title: "Штраф 50% суд может не взыскать.", text: "С 01.02.2026 штраф не взыскивают, если требование не выполнено по вине самого потребителя, из-за нарушения со стороны контрагента продавца при добросовестном выборе или если стороны заключили медиативное соглашение (п. 7 ст. 13 Закона). Сохраняйте доказательства, что вы дали продавцу всё нужное: товар на проверку, реквизиты." });
      if (d.has("penalty")) g.push({ title: "Ответчик попросит снизить неустойку.", text: "Суд вправе уменьшить её по ст. 333 ГК, если она явно несоразмерна. Приложите подробный расчёт — это помогает отстоять сумму." });
      g.push({ title: "Если до решения ответчик вернёт деньги — не отказывайтесь от иска.", text: "При отказе от иска штраф не взыщут (п. 47 Пленума ВС № 17). Лучше уточнить требования: деньги получены, а неустойку, моральный вред и штраф просите взыскать." });
      return g;
    },

    fileName(a) { return "Исковое заявление о защите прав потребителя" + (a.seller_name ? " к " + String(a.seller_name).replace(/[\\/:*?"<>|«»]/g, "").slice(0, 40) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d91 = spec;
})(typeof window !== "undefined" ? window : globalThis);
