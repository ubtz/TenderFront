import axios from "axios";

const getApiBaseUrl = () => import.meta.env.VITE_API_URL;

export const fetchSystemRequestLogs = async (params) => {
  const response = await axios.get(`${getApiBaseUrl()}/get/SystemRequestLogs`, { params });
  return response.data;
};
