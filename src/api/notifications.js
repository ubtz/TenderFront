import axios from "axios";

const getApiBaseUrl = () => import.meta.env.VITE_API_URL;

export const fetchNotificationCount = async () => {
  const response = await axios.get(`${getApiBaseUrl()}/get/NotificationCount`);
  return Number(response.data?.count) || 0;
};

export const fetchNotifications = async () => {
  const response = await axios.get(`${getApiBaseUrl()}/get/Notifications`);
  return Array.isArray(response.data) ? response.data : [];
};

export const markNotificationRead = (notificationId) =>
  axios.put(`${getApiBaseUrl()}/put/NotificationRead/${notificationId}`);

export const markAllNotificationsRead = () =>
  axios.put(`${getApiBaseUrl()}/put/NotificationsReadAll`);
