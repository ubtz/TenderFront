import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Empty, List, Popover, Spin, Tag, Typography, message } from "antd";
import { BellOutlined, CheckOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  fetchNotificationCount,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications";
import "./NotificationCenter.css";

const { Text } = Typography;
const POLL_INTERVAL_MS = 45 * 1000;

const unwrapText = (value) => {
  if (value && typeof value === "object" && "String" in value) return value.Valid === false ? "" : value.String || "";
  return value == null ? "" : String(value);
};

const notificationTypeLabel = {
  plan_assignment: "Төлөвлөгөө",
  order_returned: "Буцаалт",
  tender_created: "Тендер",
  contract_assigned: "Гэрээ",
  tender_suspended: "Түдгэлзүүлсэн",
  due_warning: "Хугацаа",
};

const NotificationCenter = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const loadCount = useCallback(async () => {
    if (!localStorage.getItem("token")) {
      setUnreadCount(0);
      return;
    }
    try {
      setUnreadCount(await fetchNotificationCount());
    } catch (error) {
      if (error?.response?.status !== 401) console.error("Notification count failed:", error);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const records = await fetchNotifications();
      setNotifications(records);
      setUnreadCount(records.filter((record) => !record.isRead).length);
    } catch (error) {
      console.error("Notifications failed:", error);
      message.error("Мэдэгдэл татаж чадсангүй");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCount();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") loadCount();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadCount, location.pathname]);

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (nextOpen) loadNotifications();
  };

  const handleNotificationClick = async (record) => {
    if (!record.isRead) {
      try {
        await markNotificationRead(record.id);
        setNotifications((current) => current.map((item) =>
          item.id === record.id ? { ...item, isRead: true } : item
        ));
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch (error) {
        console.error("Mark notification read failed:", error);
      }
    }
    const link = unwrapText(record.link);
    if (link) {
      setOpen(false);
      navigate(link);
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Mark all notifications read failed:", error);
      message.error("Мэдэгдлүүдийг уншсанаар тэмдэглэж чадсангүй");
    }
  };

  const content = (
    <div className="notification-panel">
      <div className="notification-panel__header">
        <div>
          <Text strong>Мэдэгдэл</Text>
          {unreadCount > 0 && <Text type="secondary">{unreadCount} шинэ</Text>}
        </div>
        {unreadCount > 0 && (
          <Button type="link" size="small" icon={<CheckOutlined />} onClick={handleReadAll}>
            Бүгдийг уншсан
          </Button>
        )}
      </div>
      <div className="notification-panel__body">
        {loading ? (
          <div className="notification-panel__loading"><Spin size="small" /></div>
        ) : notifications.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Мэдэгдэл алга" />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(record) => (
              <List.Item
                key={record.id}
                className={record.isRead ? "notification-item" : "notification-item is-unread"}
                onClick={() => handleNotificationClick(record)}
              >
                <div className="notification-item__dot" />
                <div className="notification-item__content">
                  <div className="notification-item__title">
                    <Text strong={!record.isRead}>{record.title}</Text>
                    <Tag bordered={false}>{notificationTypeLabel[record.type] || "Мэдэгдэл"}</Tag>
                  </div>
                  {unwrapText(record.message) && <Text type="secondary">{unwrapText(record.message)}</Text>}
                  <Text type="secondary" className="notification-item__date">
                    {dayjs(record.createdAt).isValid() ? dayjs(record.createdAt).format("YYYY.MM.DD HH:mm") : ""}
                  </Text>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight" open={open} onOpenChange={handleOpenChange}>
      <Badge count={unreadCount} size="small" overflowCount={99}>
        <Button type="text" shape="circle" icon={<BellOutlined />} className="notification-bell" aria-label="Мэдэгдэл" />
      </Badge>
    </Popover>
  );
};

export default NotificationCenter;
