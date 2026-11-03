import axios from "axios";

const getApiBaseUrl = () => import.meta.env.VITE_API_URL;

export const fetchBusinessAuditLogs = async (params) => {
  const response = await axios.get(`${getApiBaseUrl()}/get/BusinessAuditLogs`, { params });
  return response.data;
};
