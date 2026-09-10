const unwrapValue = (value) => {
  if (!value || typeof value !== "object") return value;
  for (const key of ["String", "Int64", "Float64", "Bool", "Time"]) {
    if (value[key] !== undefined && value[key] !== null) return value[key];
  }
  return "";
};

const externalOrderFields = [
  "rid", "acct", "code", "cr1id", "cr2id", "cr3id", "cr4id",
  "crbrand", "crmark", "cr1name", "cr4name", "crbrandname", "crmarkname",
  "mdocno", "ddate", "measid", "mname", "usize", "barcode", "zno",
  "qty", "qty_nha", "price", "pricesum", "dedate", "cdate", "dcode",
  "dname", "udate", "plan", "planurl", "plandate", "tech", "techurl",
  "techdate", "pkgno", "pkgdate", "pkgname",
];

const normalizeIdentityDate = (value) => {
  const normalized = String(unwrapValue(value) ?? "").trim().split(/[T ]/)[0];
  const match = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  return match
    ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`
    : normalized;
};

export const normalizeExternalOrder = (record = {}) => {
  const valuesByLowercaseKey = new Map(
    Object.entries(record).map(([key, value]) => [key.toLocaleLowerCase(), unwrapValue(value)])
  );
  const normalized = externalOrderFields.reduce(
    (normalized, field) => ({
      ...normalized,
      [field]: String(valuesByLowercaseKey.get(field) ?? "").trim(),
    }),
    { ...record }
  );
  return {
    ...normalized,
    deathdate: String(valuesByLowercaseKey.get("deathdate") ?? "").trim(),
  };
};

export const getOrderIdentity = (item) =>
  [
    item.pkgno,
    normalizeIdentityDate(item.pkgdate),
    item.rid,
    item.zno,
    item.code,
    item.dname,
    item.dcode,
    Number(unwrapValue(item.price)),
    Number(unwrapValue(item.qty)),
    item.mdocno,
  ]
    .map((value) => String(unwrapValue(value) ?? "").trim())
    .join("-");

export const getOrderOwnershipIdentity = (item) =>
  [
    item.pkgno,
    normalizeIdentityDate(item.pkgdate),
    item.pkgname,
    item.code,
  ]
    .map((value) => String(unwrapValue(value) ?? "").trim().toLocaleLowerCase())
    .join("|");

export const getOrderRowKey = (item, year, month, index) =>
  `${year}-${month}-${getOrderIdentity(item)}-${String(
    item.rid || item.zno || "record"
  ).trim()}-${index}`;

export const getOrderMonth = (item) => {
  const value = item.pkgdate?.String ?? item.pkgdate ?? item.cdate?.String ?? item.cdate;
  if (!value) return null;

  const dateMatch = String(value).trim().match(/^\d{4}[-/](\d{1,2})/);
  if (dateMatch) return Number(dateMatch[1]);

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getMonth() + 1;
};

export const getOrderYear = (item) => {
  const value = item.pkgdate?.String ?? item.pkgdate ?? item.cdate?.String ?? item.cdate;
  const match = String(value || "").trim().match(/^(\d{4})[-/]/);
  return match?.[1] || "";
};

const formatISO = (value) => {
  if (!value) return null;
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
};

export const createBasketItemPayload = (item, basketId) => ({
  basketId,
  acct: item.acct,
  barcode: item.barcode,
  cdate: formatISO(item.cdate),
  ddate: formatISO(item.ddate),
  dedate: formatISO(item.dedate),
  deathdate: formatISO(item.deathdate),
  udate: formatISO(item.udate),
  code: item.code,
  dcode: item.dcode,
  dname: item.dname,
  mdocno: item.mdocno,
  measid: item.measid,
  mname: item.mname,
  qty: item.qty?.toString() || "",
  price: item.price?.toString() || "",
  pricesum: item.pricesum?.toString() || "",
  pkgno: item.pkgno,
  pkgname: item.pkgname,
  pkgdate: item.pkgdate,
  planurl: item.planurl,
  techurl: item.techurl,
  techdate: item.techdate,
  plandate: item.plandate,
  usize: item.usize,
  rid: item.rid,
  zno: item.zno,
  cr1id: item.cr1id,
  cr1name: item.cr1name,
  cr2id: item.cr2id,
  cr3id: item.cr3id,
  cr4id: item.cr4id,
  cr4name: item.cr4name,
  crbrand: item.crbrand,
  crbrandname: item.crbrandname,
  crmark: item.crmark,
  crmarkname: item.crmarkname,
  key: "",
});
