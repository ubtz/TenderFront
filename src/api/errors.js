const fallbackMessageByStatus = {
  400: "Хүсэлтийн мэдээлэл буруу байна",
  401: "Дахин нэвтэрнэ үү",
  403: "Энэ үйлдлийг хийх эрхгүй байна",
  404: "Хүссэн мэдээлэл олдсонгүй",
  409: "Мэдээллийн төлөв зөрчилтэй байна",
  413: "Илгээсэн мэдээллийн хэмжээ хэтэрсэн байна",
  500: "Серверийн дотоод алдаа гарлаа",
  502: "Гадаад системтэй холбогдож чадсангүй",
  503: "Үйлчилгээ түр хугацаанд боломжгүй байна",
};

export const getApiErrorDetails = (error, fallbackMessage = "Үйлдлийг гүйцэтгэж чадсангүй") => {
  const status = Number(error?.response?.status) || 0;
  const data = error?.response?.data;
  const responseMessage = typeof data === "string"
    ? data
    : data?.message || data?.error;
  const requestId = data?.requestId || error?.response?.headers?.["x-request-id"] || "";

  return {
    status,
    code: data?.code || (status ? `HTTP_${status}` : "NETWORK_ERROR"),
    message: responseMessage || fallbackMessageByStatus[status] || fallbackMessage,
    requestId,
  };
};

export const getApiErrorMessage = (error, fallbackMessage) =>
  getApiErrorDetails(error, fallbackMessage).message;

export const normalizeAxiosError = (error) => {
  const details = getApiErrorDetails(error);
  error.apiError = details;
  error.requestId = details.requestId;

  if (error.response) {
    const currentData = error.response.data;
    error.response.data = {
      ...(currentData && typeof currentData === "object" ? currentData : {}),
      success: false,
      error: details.message,
      message: details.message,
      code: details.code,
      requestId: details.requestId,
    };
  }

  return Promise.reject(error);
};
