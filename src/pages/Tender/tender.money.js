export const parseBudgetAmount = (value) => String(value ?? "").replace(/['’\s,]/g, "");

export const formatBudgetAmount = (value) => {
  const [whole, fraction] = parseBudgetAmount(value).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
};
