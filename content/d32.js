/*
 * Д-32. Претензия заказчику о неоплате услуг (для самозанятого).
 * Основа: ГК РФ — ст. 309, 310 (надлежащее исполнение, недопустимость одностороннего отказа), ст. 779, 781 (оплата
 * в сроки договора), ст. 720, 783 (приёмка), п. 2 ст. 314 (7 дней, если срок не установлен), ст. 395 (проценты по
 * ключевой ставке, по день уплаты; расчёт — C.comp395), ст. 193 (перенос срока с нерабочего дня). Арбитраж или суд общей
 * юрисдикции: самозанятый — физлицо, спор с организацией рассматривает суд общей юрисдикции; претензионный порядок —
 * если предусмотрен договором. Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;

  function derive(a) {
    const amount = typeof a.amount === "number" ? a.amount : null;
    const pays = C.parseDatedSums(a.partial).filter(p => p.date && p.amount);
    const paid = pays.reduce((s, p) => s + p.amount, 0);
    const rest = amount != null ? Math.round((amount - paid) * 100) / 100 : null;
    const dueRaw = U.date(a.due_date);
    const due = dueRaw ? C.nextWorkday(dueRaw) : null;
    const overdue = !!(due && U.today() > due);
    const p395 = overdue && amount ? C.comp395(amount - pays.filter(p => p.date <= due).reduce((s, p) => s + p.amount, 0), U.addDays(due, 1), U.today(), pays.filter(p => p.date > due)) : null;
    return { amount, pays, paid, rest, due, dueRaw, overdue, p395 };
  }

  const spec = {
    id: "d32",
    code: "Д-32",
    title: "Претензия заказчику о неоплате",
    lead: "Работу сдали, а заказчик не платит. Претензия с расчётом процентов за просрочку по ставке ЦБ. Займёт около 5 минут.",
    status: "draft",
    actual: "08.11.2026",

    steps: [
      {
        id: "debt", title: "Долг",
        questions: [
          { id: "contract", type: "text", label: "Договор: номер и дата", required: false, placeholder: "№ 5 от 01.09.2026", hint: "Если договора нет — оставьте пустым: подойдут переписка и акт" },
          { id: "subject", type: "text", label: "Что вы сделали", placeholder: "дизайн сайта: главная и 5 внутренних страниц" },
          { id: "accepted", type: "choice", label: "Как заказчик принял работу?", options: [
            { value: "act", label: "Подписал акт" },
            { value: "silent", label: "Акт отправлен, возражений не было" },
            { value: "used", label: "Акта нет, но результат использует" },
          ] },
          { id: "act_date", type: "date", label: "Дата акта или сдачи работы" },
          { id: "amount", type: "money", label: "Сумма к оплате по договору", suffix: "₽", min: 1 },
          { id: "partial", type: "textarea", label: "Что уже оплачено", required: false, hint: "Каждый платёж с новой строки: дата; сумма", placeholder: "05.09.2026; 20000",
            validate: v => { const bad = C.parseDatedSums(v).filter(x => !x.date || !x.amount); return bad.length ? `Не получилось прочитать: «${bad[0].raw}»` : null; } },
          { id: "due_date", type: "date", label: "Крайний срок оплаты по договору", hint: "Если в договоре срока нет — дата вашего первого требования об оплате + 7 дней" },
        ],
      },
      { id: "me", title: "Вы", questions: C.freelancerQuestions() },
      { id: "client", title: "Заказчик", questions: C.clientQuestions() },
    ],

    derive,

    stop(a, d) {
      if (d.due && !d.overdue) return { title: "Срок оплаты ещё не прошёл.", text: `Требовать проценты можно после ${U.fmtDate(d.due)}. Напомнить об оплате письмом можно уже сейчас.` };
      if (d.rest != null && d.rest <= 0) return { title: "По вашим данным всё оплачено.", text: "Проверьте суммы платежей." };
      return null;
    },

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      C.header({ name: a.cl_name, nameLabel: "заказчик", inn: a.cl_type === "org" ? a.cl_inn : null, address: a.cl_address }, { name: a.ex_name, address: a.ex_address, phone: a.ex_phone, email: a.ex_email }, P);
      C.title(P, "ПРЕТЕНЗИЯ", "об оплате оказанных услуг");
      T((a.contract ? `По договору ${a.contract}` : "По нашей договорённости") + ` я оказал(а) вам услуги: ${F(a.subject, "что сделано")}. ` + {
        act: `Услуги приняты вами по акту от ${F(U.fmtDate(U.date(a.act_date)), "дата")}.`,
        silent: `Акт об оказании услуг направлен вам ${F(U.fmtDate(U.date(a.act_date)), "дата")}; мотивированных возражений в установленный срок не поступило, поэтому услуги считаются принятыми.`,
        used: `Результат передан вам ${F(U.fmtDate(U.date(a.act_date)), "дата")} и используется вами, что подтверждает принятие услуг.`,
      }[a.accepted || "act"]);
      T(`Стоимость услуг — ${F(U.money(d.amount), "сумма")} руб. Срок оплаты истёк ${F(U.fmtDate(d.dueRaw), "дата")}.` + (d.paid ? ` Оплачено: ${d.pays.map(p => `${U.fmtDate(p.date)} — ${U.money(p.amount)} руб`).join("; ")}. Задолженность — ${U.money(d.rest)} руб.` : ` Оплата не поступила.`));
      T("В соответствии со ст. 309, 310, 781 Гражданского кодекса РФ заказчик обязан оплатить оказанные ему услуги в сроки и в порядке, указанные в договоре. Односторонний отказ от исполнения обязательства не допускается.");
      if (d.p395 && d.p395.total > 0) P.push({ text: `На сумму задолженности подлежат уплате проценты по ст. 395 ГК РФ. Расчёт на ${U.fmtDate(U.today())}:\n` + d.p395.parts.map(p => `${U.money(p.base)} руб. × ${p.days} дн. (${U.fmtDate(p.from)}–${U.fmtDate(p.to)}) × ${String(p.rate).replace(".", ",")}% / ${p.yearDays} = ${U.money(p.sum)} руб.`).join("\n") + `\nИтого: ${U.money(d.p395.total)} руб.`, align: "left", leftIndent: 709 });
      P.push({ text: "ТРЕБУЮ в течение 10 календарных дней со дня получения претензии:", indent: true, keepNext: true });
      T(`1. Оплатить задолженность в размере ${F(U.money(d.rest), "сумма")} руб.`);
      if (d.p395 && d.p395.total > 0) T(`2. Уплатить проценты по ст. 395 ГК РФ в размере ${U.money(d.p395.total)} руб., а также проценты за последующие дни по день фактической оплаты.`);
      P.push({ text: `Реквизиты для оплаты:\n${C.exRequisites(a).split("\n").slice(4).join("\n")}\nПолучатель: ${F(a.ex_name, "ФИО")}, ИНН ${F(a.ex_inn, "ИНН")}`, align: "left", leftIndent: 709 });
      T("В случае неоплаты я обращусь в суд с иском о взыскании задолженности, процентов по день фактического исполнения обязательства и судебных расходов.");
      C.attachments(P, [a.contract ? "Копия договора." : null, a.accepted === "act" ? "Копия подписанного акта." : "Копия акта и доказательство его направления.", "Переписка с заказчиком (при наличии)."].filter(Boolean));
      P.push({ text: `«___» ____________ 20__ г.            ____________ / ${F(U.shortName(a.ex_name), "И. О. Фамилия")}`, align: "left", before: 360 });
      return P;
    },

    guidance(a) {
      return [
        { title: "Отправьте на юридический адрес заказчика заказным письмом с описью и продублируйте по e-mail.", text: "Если в договоре предусмотрена связь через мессенджер — отправьте и туда, сохраните скриншот." },
        { title: "Не заплатили — в суд.", text: a.cl_type === "org" ? "Самозанятый — физическое лицо, поэтому спор с организацией рассматривает районный суд (до 50 000 ₽ — мировой судья) по месту нахождения ответчика, если договор не устанавливает иное. При сумме до 500 000 ₽ и подписанном акте можно попросить судебный приказ." : "С физическим лицом — мировой судья (до 50 000 ₽) или районный суд по месту жительства ответчика." },
        { title: "Чек выдаётся после оплаты.", text: "Не формируйте чек заранее, пока деньги не пришли." },
      ];
    },

    fileName(a) { return "Претензия об оплате" + (a.cl_name ? " — " + String(a.cl_name).replace(/[«»"]/g, "").slice(0, 30) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d32 = spec;
})(typeof window !== "undefined" ? window : globalThis);
