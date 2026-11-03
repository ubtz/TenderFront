import axios from "axios";

const ORDERS_API_URL = `${import.meta.env.VITE_API_URL}/external/orders`;

const unwrapApiValue = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return value;
  for (const key of ["String", "Time", "Value", "value"]) {
    if (value[key] !== undefined && value[key] !== null) return unwrapApiValue(value[key]);
  }
  return "";
};

const normalizeOrderDate = (value) =>
  String(unwrapApiValue(value) || "")
    .trim()
    .split(/[T ]/)[0]
    .replace(/-/g, "/");

const normalizeText = (value) => String(unwrapApiValue(value) || "").trim();

export const fetchOrdersToken = async () => "server-managed";

export const fetchOrders = async (year, month, token, options = {}) => {
  const url = `${ORDERS_API_URL}/list`;
  const response = await axios.post(url, {
    Yy: year,
    Mm: month,
    Man: "",
    Token: token,
  }, {
    params: options.audit ? { audit: true } : undefined,
  });

  return response;
};

export const updateOrderStatus = (pkgno, pkgdate, state) =>
  axios.post(`${ORDERS_API_URL}/status`, {
    Pkgno: normalizeText(pkgno),
    Pkgdate: normalizeOrderDate(pkgdate),
    State: state,
  });

export const returnOrder = async (pkgno, pkgdate, man, comment, cancel, token) => {
  const payload = {
    Token: token,
    PkgDate: normalizeOrderDate(pkgdate),
    PkgNo: normalizeText(pkgno),
    Man: normalizeText(man),
    Comment: normalizeText(comment),
    Cancel: Boolean(cancel),
  };
  console.log("[orders/back] payload", payload);

  const requestLog = {
    url: `${ORDERS_API_URL}/back`,
    pkgNo: payload.PkgNo,
    pkgDate: payload.PkgDate,
    man: payload.Man,
    comment: payload.Comment,
    cancel: payload.Cancel,
  };
  console.log("[orders/back] request", requestLog);

  try {
    const response = await axios.post(`${ORDERS_API_URL}/back`, payload);
    console.log("[orders/back] response", {
      status: response.status,
      data: response.data,
      request: requestLog,
    });
    return response;
  } catch (error) {
    error.requestLog = requestLog;
    console.error("[orders/back] failed", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      request: requestLog,
    });
    throw error;
  }
};
