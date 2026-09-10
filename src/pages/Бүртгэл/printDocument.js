const number = (value) => Number(String(value ?? "").replace(/,/g, "")) || 0;
const text = (value) => String(value ?? "");
const money = (value) => number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
const cell = (value, alignment = "center") => ({ text: text(value), fontSize: 8, alignment });

export const execTeamFormValues = (team) => {
  const parse = (value) => text(value).split(",").map((entry) => entry.trim()).filter(Boolean)
    .map((entry) => {
      const [label, ...name] = entry.split(":");
      return { label: label.trim(), name: name.join(":").trim() };
    });
  return {
    Mod: parse(team?.["Батлах"]),
    approved: parse(team?.["Зөвшөөрсөн"]),
    executed: parse(team?.["Гүйцэтгэсэн"]),
  };
};

export const execTeamPayload = (values, planId, userId) => {
  const serialize = (entries = []) => entries
    .filter((entry) => entry && (entry.label?.trim() || entry.name?.trim()))
    .map((entry) => `${text(entry.label).trim()}: ${text(entry.name).trim()}`).join(", ");
  return {
    planRootNumber: text(planId),
    userId: Number(userId),
    batlah: serialize(values.Mod),
    zuvshuursun: serialize(values.approved),
    guitsetgesen: serialize(values.executed),
  };
};

export const buildPlanPrintDocument = (plan, signatures = {}, date = new Date()) => {
  if (!Array.isArray(plan?.baskets)) throw new Error("Төлөвлөгөөний мэдээлэл олдсонгүй");
  const baskets = plan.baskets.filter((basket) => Array.isArray(basket.items) && basket.items.length);
  const itemAmount = (item) => number(item.qty) * number(item.price);
  const basketAmount = (basket) => basket.items.reduce((sum, item) => sum + itemAmount(item), 0);
  const total = plan.total_price ?? baskets.reduce((sum, basket) => sum + basketAmount(basket), 0);
  const rows = [];
  const spanColumn = (start, count, column) => {
    if (count <= 1) return;
    rows[start][column].rowSpan = count;
    for (let offset = 1; offset < count; offset++) rows[start + offset][column] = {};
  };
  baskets.forEach((basket) => {
    const start = rows.length;
    basket.items.forEach((item, index) => {
      rows.push([
        cell(basket.basket_number), cell(basket.basket_name),
        cell(index + 1), cell([item.cr4name, item.crmarkname].filter(Boolean).join(" * "), "left"),
        cell(item.usize), cell(item.zno), cell(item.mname), cell(money(item.qty)),
        cell(money(item.price), "right"), cell(money(itemAmount(item)), "right"),
        cell(money(basket.total_price ?? basketAmount(basket)), "right"), cell(money(total), "right"),
        cell(basket.publish_date), cell(item.dname),
      ]);
    });
    // Merge within each basket so equal names or numbers cannot merge separate baskets.
    [0, 1, 10, 12].forEach((column) => spanColumn(start, basket.items.length, column));
  });
  spanColumn(0, rows.length, 11);

  const heading = (label, extra = {}) => ({ ...cell(label), bold: true, ...extra });
  const headers = [
    [
      heading("Багц", { colSpan: 2 }), {},
      heading("Бараа материал", { colSpan: 8 }), {}, {}, {}, {}, {}, {}, {},
      ...["Багцын дүн, төг", "Тендерийн нийт дүн, төг", "Тендер зарлах огноо", "Захиалагч"]
        .map((label) => heading(label, { rowSpan: 2 })),
    ],
    [
      ...["№", "Нэр", "№", "Нэр", "Нормт хэмжээ", "Зургийн дугаар", "Хэмжих нэгж", "Тоо хэмжээ", "Нэгж үнэ, төг", "Нийт дүн, төг"]
        .map((label) => heading(label, { fontSize: 6 })),
      {}, {}, {}, {},
    ],
  ];
  const signatureText = (value) => text(value).split(",").map((entry) => entry.trim().replace(":", "              ")).join("\n");
  return {
    pageOrientation: "landscape",
    defaultStyle: { font: "Roboto", fontSize: 8 },
    content: [
      { text: "Батлав" },
      { text: signatureText(signatures.batlah) },
      { text: `[${plan.plan_name || ""}]`, alignment: "center", margin: [0, 10, 0, 0] },
      { text: "/Дэлгэрэнгүй/", alignment: "center" },
      { text: `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`, alignment: "right" },
      {
        margin: [0, 5, 0, 15],
        table: {
          headerRows: 2,
          widths: ["3%", "10%", "3%", "15%", "5%", "5%", "5%", "5%", "7%", "8%", "8%", "8%", "8%", "10%"],
          body: [...headers, ...rows],
        },
        layout: { paddingTop: () => 4, paddingBottom: () => 4 },
      },
      ...[
        "Зөвшилцсөн:", signatureText(signatures.zuvshuursun),
        "Гүйцэтгэсэн:", signatureText(signatures.guitsetgesen),
      ].map((value) => ({ text: value, margin: [130, 5, 0, 0] })),
    ],
    footer: (currentPage) => ({
      columns: [
        { text: "© Цахим худалдан авалтын систем", alignment: "left" },
        { text: `Хуудас: ${currentPage}`, alignment: "right" },
      ],
      margin: [30, 0, 30, 0], fontSize: 7, italics: true,
    }),
    info: { title: "Гүйцэтгэл" },
  };
};
