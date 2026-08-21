import axios from "axios";

const ORDERS_API_URL = `${import.meta.env.VITE_API_URL}/external/orders`;

export const fetchOrdersToken = async () => "server-managed";

export const fetchOrders = async (year, month, token) => {
  const url = `${ORDERS_API_URL}/list`;
  const response = await axios.post(url, {
    Yy: year,
    Mm: month,
    Man: "",
    Token: token,
  });

  return response;
};

export const updateOrderStatus = (pkgno, pkgdate, state) =>
  axios.post(`${ORDERS_API_URL}/status`, {
    Pkgno: pkgno,
    Pkgdate: pkgdate.replace(/-/g, "/"),
    State: state,
  });

export const returnOrder = async (pkgno, pkgdate, man, comment, cancel, token) => {
  const payload = {
    Token: token,
    PkgDate: String(pkgdate).split("T")[0].replace(/-/g, "/"),
    PkgNo: String(pkgno || "").trim(),
    Man: String(man || "").trim(),
    Comment: String(comment || "").trim(),
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
    console.error("[orders/back] failed", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      request: requestLog,
    });
    throw error;
  }
};
