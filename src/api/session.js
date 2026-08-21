import axios from "axios";
import { jwtDecode } from "jwt-decode";

const HEARTBEAT_INTERVAL_MS = 60 * 1000;
let authInterceptorId = null;

const getApiBaseUrl = () => import.meta.env.VITE_API_URL;

const getToken = () => localStorage.getItem("token");

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("data") || "null");
  } catch {
    localStorage.removeItem("data");
    return null;
  }
};

export const getTokenClaims = () => {
  try {
    const token = getToken();
    return token ? jwtDecode(token) : null;
  } catch {
    return null;
  }
};

export const getSessionRole = () => getTokenClaims()?.role || "";

export const installAxiosAuth = () => {
  if (authInterceptorId !== null) return;
  authInterceptorId = axios.interceptors.request.use((config) => {
    const token = getToken();
    const apiBaseUrl = getApiBaseUrl();
    const url = config.url || "";
    const isTenderApiRequest =
      apiBaseUrl && (url.startsWith(apiBaseUrl) || url.startsWith("/"));

    if (token && isTenderApiRequest) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });
};

export const sendHeartbeat = async () => {
  const token = getToken();
  const apiBaseUrl = getApiBaseUrl();

  if (!token || !apiBaseUrl) return;

  const response = await axios.post(`${apiBaseUrl}/post/heartbeat`, null, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.data?.token) {
    localStorage.setItem("token", response.data.token);
  }
};

export const startSessionHeartbeat = (onFailure) => {
  let stopped = false;
  let requestInFlight = false;
  let failureHandled = false;

  const beat = async () => {
    if (stopped || requestInFlight || document.visibilityState !== "visible") return;

    requestInFlight = true;
    try {
      await sendHeartbeat();
    } catch (error) {
      if (stopped || failureHandled) return;
      failureHandled = true;
      stopped = true;
      localStorage.removeItem("token");
      localStorage.removeItem("data");
      onFailure?.(error);
    } finally {
      requestInFlight = false;
    }
  };

  beat();

  const intervalId = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") beat();
  };

  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    stopped = true;
    window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
};

export const logoutSession = async () => {
  const token = getToken();
  const apiBaseUrl = getApiBaseUrl();

  if (!token || !apiBaseUrl) return;

  await axios.post(`${apiBaseUrl}/post/logout`, null, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};
