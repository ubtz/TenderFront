import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Input,
  InputNumber,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  ApiOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { fetchSystemRequestLogs } from "../../api/systemLogs";
import "./SystemRequestLogs.css";

const { RangePicker } = DatePicker;
const { Paragraph, Text, Title } = Typography;

const periodRange = (period) => {
  if (period === "today") return [dayjs(), dayjs()];
  if (period === "30") return [dayjs().subtract(29, "day"), dayjs()];
  return [dayjs().subtract(6, "day"), dayjs()];
};

const createFilters = () => ({
  dateRange: periodRange("7"),
  path: "",
  method: "",
  level: "",
  environment: "",
  userId: null,
  statusCode: null,
  ipAddress: "",
  slowOnly: false,
});

const initialSummary = {
  total: 0,
  successful: 0,
  warnings: 0,
  errors: 0,
  slowRequests: 0,
  averageDurationMs: 0,
};

const methodColor = {
  GET: "blue",
  POST: "green",
  PUT: "gold",
  PATCH: "purple",
  DELETE: "red",
};

const statusColor = (statusCode) => {
  if (statusCode >= 500) return "red";
  if (statusCode >= 400) return "orange";
  if (statusCode >= 300) return "blue";
  return "green";
};

const statusLabel = (statusCode) => {
  if (statusCode >= 500) return "Серверийн алдаа";
  if (statusCode >= 400) return "Хүсэлтийн алдаа";
  if (statusCode >= 300) return "Дамжуулалт";
  return "Амжилттай";
};

const formatDuration = (durationMs) => {
  const value = Number(durationMs) || 0;
  return value >= 1000 ? `${(value / 1000).toFixed(2)} сек` : `${value} мс`;
};

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function SystemRequestLogs() {
  const initialFilters = useMemo(createFilters, []);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(initialSummary);
  const [topPaths, setTopPaths] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [period, setPeriod] = useState("7");
  const [refreshSeconds, setRefreshSeconds] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);

  const loadLogs = useCallback(async (page = pagination.current, pageSize = pagination.pageSize, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [from, to] = filters.dateRange || [];
      const payload = await fetchSystemRequestLogs({
        page,
        pageSize,
        from: from?.format("YYYY-MM-DD"),
        to: to?.format("YYYY-MM-DD"),
        path: filters.path || undefined,
        method: filters.method || undefined,
        level: filters.level || undefined,
        environment: filters.environment || undefined,
        userId: filters.userId || undefined,
        statusCode: filters.statusCode || undefined,
        ipAddress: filters.ipAddress || undefined,
        slowOnly: filters.slowOnly || undefined,
      });
      setRows(Array.isArray(payload?.rows) ? payload.rows : []);
      setSummary(payload?.summary || initialSummary);
      setTopPaths(Array.isArray(payload?.topPaths) ? payload.topPaths : []);
      setPagination({ current: page, pageSize, total: Number(payload?.total) || 0 });
      setLastUpdated(payload?.generatedAt ? dayjs(payload.generatedAt) : dayjs());
    } catch (error) {
      console.error("System request logs failed:", error);
      if (!silent) {
        message.error(error.response?.status === 403
          ? "Системийн лог харах эрхгүй байна"
          : "Системийн лог татаж чадсангүй");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters, pagination.current, pagination.pageSize]);

  useEffect(() => {
    loadLogs(1, pagination.pageSize);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!refreshSeconds) return undefined;
    const intervalId = window.setInterval(
      () => loadLogs(pagination.current, pagination.pageSize, true),
      refreshSeconds * 1000,
    );
    return () => window.clearInterval(intervalId);
  }, [loadLogs, pagination.current, pagination.pageSize, refreshSeconds]);

  const successRate = summary.total > 0
    ? Math.round((summary.successful / summary.total) * 1000) / 10
    : 0;
  const issueRate = summary.total > 0
    ? Math.round(((summary.warnings + summary.errors) / summary.total) * 1000) / 10
    : 0;

  const applyFilters = () => {
    setPagination((current) => ({ ...current, current: 1 }));
    setFilters({ ...draftFilters });
  };

  const selectPeriod = (value) => {
    setPeriod(value);
    if (value === "custom") return;
    const dateRange = periodRange(value);
    const nextFilters = { ...draftFilters, dateRange };
    setDraftFilters(nextFilters);
    setPagination((current) => ({ ...current, current: 1 }));
    setFilters(nextFilters);
  };

  const resetFilters = () => {
    const reset = createFilters();
    setPeriod("7");
    setDraftFilters(reset);
    setPagination((current) => ({ ...current, current: 1 }));
    setFilters(reset);
  };

  const filterByPath = (path) => {
    const nextFilters = { ...draftFilters, path };
    setDraftFilters(nextFilters);
    setPagination((current) => ({ ...current, current: 1 }));
    setFilters(nextFilters);
  };

  const copyText = async (value, label = "Утга") => {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      message.success(`${label} хууллаа`);
    } catch {
      message.error("Хуулах боломжгүй байна");
    }
  };

  const exportCurrentPage = () => {
    if (!rows.length) {
      message.info("Экспортлох мэдээлэл алга");
      return;
    }
    const header = ["Огноо", "Method", "Path", "Status", "User ID", "Хэрэглэгч", "Role", "IP", "Duration ms", "Environment", "Request ID"];
    const lines = rows.map((record) => [
      dayjs(record.createdAt).format("YYYY-MM-DD HH:mm:ss"),
      record.method,
      record.path,
      record.statusCode,
      record.userId,
      record.actorName,
      record.userRole,
      record.ipAddress,
      record.durationMs,
      record.environment,
      record.requestId,
    ].map(csvCell).join(","));
    const blob = new Blob([`\ufeff${header.map(csvCell).join(",")}\n${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `system-logs-${dayjs().format("YYYYMMDD-HHmm")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo(() => [
    {
      title: "Огноо",
      dataIndex: "createdAt",
      width: 148,
      fixed: "left",
      render: (value) => (
        <div className="system-log-date">
          <strong>{dayjs(value).format("YYYY.MM.DD")}</strong>
          <span>{dayjs(value).format("HH:mm:ss")}</span>
        </div>
      ),
    },
    {
      title: "Хүсэлт",
      key: "request",
      width: 330,
      render: (_, record) => (
        <div className="system-log-request">
          <Tag color={methodColor[record.method] || "default"}>{record.method}</Tag>
          <Tooltip title={record.path}>
            <Text ellipsis>{record.path}</Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: "Төлөв",
      dataIndex: "statusCode",
      width: 96,
      align: "center",
      render: (value) => <Tag color={statusColor(value)}>{value}</Tag>,
    },
    {
      title: "Хэрэглэгч / систем",
      key: "user",
      width: 220,
      render: (_, record) => record.userId ? (
        <div className="system-log-user">
          <strong>{record.actorName || `Хэрэглэгч #${record.userId}`}</strong>
          <span>#{record.userId} · {record.userRole || "Эрх тодорхойгүй"}</span>
        </div>
      ) : (
        <div className="system-log-user">
          <strong>Систем / API</strong>
          <span>{record.userAgent?.startsWith("Go-") ? "Go service" : "Нэвтрээгүй хүсэлт"}</span>
        </div>
      ),
    },
    {
      title: "IP хаяг",
      dataIndex: "ipAddress",
      width: 132,
      render: (value) => value || "—",
    },
    {
      title: "Хугацаа",
      dataIndex: "durationMs",
      width: 110,
      align: "right",
      sorter: (first, second) => Number(first.durationMs) - Number(second.durationMs),
      render: (value) => (
        <Text className={Number(value) >= 1000 ? "system-log-duration is-slow" : "system-log-duration"}>
          {formatDuration(value)}
        </Text>
      ),
    },
    {
      title: "Орчин",
      dataIndex: "environment",
      width: 84,
      align: "center",
      render: (value) => <Tag bordered={false} color={value === "prod" ? "geekblue" : "default"}>{value}</Tag>,
    },
    {
      title: "Request ID",
      dataIndex: "requestId",
      width: 152,
      ellipsis: true,
      render: (value) => (
        <Tooltip title="Дэлгэрэнгүй харах">
          <Text code>{value?.slice(0, 10)}…</Text>
        </Tooltip>
      ),
    },
  ], []);

  return (
    <div className="system-logs-page">
      <div className="system-logs-heading">
        <div>
          <Space size={8} align="center">
            <span className="system-logs-heading-icon"><ApiOutlined /></span>
            <Title level={3}>Системийн лог</Title>
          </Space>
          <Text type="secondary">API хүсэлт, алдаа, хэрэглэгчийн үйлдэл болон гүйцэтгэлийн нэгдсэн хяналт</Text>
        </div>
        <Space wrap>
          {lastUpdated && <Text type="secondary" className="system-log-updated">Шинэчилсэн {lastUpdated.format("HH:mm:ss")}</Text>}
          <Select
            value={refreshSeconds}
            onChange={setRefreshSeconds}
            className="system-log-refresh-select"
            options={[
              { value: 0, label: "Авто шинэчлэлтгүй" },
              { value: 15, label: "15 секунд" },
              { value: 30, label: "30 секунд" },
              { value: 60, label: "1 минут" },
            ]}
          />
          <Button icon={<DownloadOutlined />} onClick={exportCurrentPage}>CSV</Button>
          <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={() => loadLogs()}>
            Шинэчлэх
          </Button>
        </Space>
      </div>

      <div className="system-log-period-bar">
        <Segmented
          value={period}
          onChange={selectPeriod}
          options={[
            { label: "Өнөөдөр", value: "today" },
            { label: "7 хоног", value: "7" },
            { label: "30 хоног", value: "30" },
            { label: "Сонгох", value: "custom" },
          ]}
        />
        <RangePicker
          value={draftFilters.dateRange}
          onChange={(dateRange) => {
            setPeriod("custom");
            setDraftFilters((current) => ({ ...current, dateRange }));
          }}
          format="YYYY.MM.DD"
          allowClear
        />
      </div>

      <Row gutter={[14, 14]} className="system-log-stats">
        <Col xs={24} sm={12} xl={4}><Card><Statistic title="Нийт хүсэлт" value={summary.total} prefix={<ApiOutlined />} /></Card></Col>
        <Col xs={24} sm={12} xl={4}><Card><Statistic title="Амжилттай" value={summary.successful} prefix={<CheckCircleOutlined />} valueStyle={{ color: "#15803d" }} suffix={<small>{successRate}%</small>} /></Card></Col>
        <Col xs={24} sm={12} xl={4}><Card><Statistic title="4xx анхааруулга" value={summary.warnings} prefix={<WarningOutlined />} valueStyle={{ color: "#d97706" }} /></Card></Col>
        <Col xs={24} sm={12} xl={4}><Card><Statistic title="5xx алдаа" value={summary.errors} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: "#dc2626" }} /></Card></Col>
        <Col xs={24} sm={12} xl={4}><Card><Statistic title="Удаан хүсэлт" value={summary.slowRequests} prefix={<ThunderboltOutlined />} valueStyle={{ color: "#c2410c" }} /></Card></Col>
        <Col xs={24} sm={12} xl={4}><Card><Statistic title="Дундаж хугацаа" value={Math.round(summary.averageDurationMs || 0)} prefix={<ClockCircleOutlined />} suffix="мс" /></Card></Col>
      </Row>

      <Row gutter={[14, 14]} className="system-log-insights">
        <Col xs={24} xl={8}>
          <Card title="Системийн төлөв" className="system-log-health-card">
            <div className="system-log-health-score">
              <Progress type="dashboard" percent={successRate} strokeColor={successRate >= 95 ? "#22a06b" : successRate >= 85 ? "#d99b28" : "#d84a4a"} size={112} />
              <div>
                <strong>{successRate >= 95 ? "Хэвийн" : successRate >= 85 ? "Анхаарах" : "Шалгах шаардлагатай"}</strong>
                <Text type="secondary">Сонгосон хугацааны амжилтын хувь</Text>
              </div>
            </div>
            <div className="system-log-health-meta">
              <span>Асуудалтай хүсэлт <strong>{issueRate}%</strong></span>
              <span>1 секундээс удаан <strong>{summary.slowRequests}</strong></span>
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card title="Хамгийн их дуудагдсан API" className="system-log-top-card">
            {topPaths.length ? topPaths.map((item, index) => {
              const maximum = Number(topPaths[0]?.count) || 1;
              return (
                <button type="button" className="system-log-top-path" key={item.path} onClick={() => filterByPath(item.path)}>
                  <span className="system-log-top-rank">{index + 1}</span>
                  <span className="system-log-top-content">
                    <span><Text ellipsis>{item.path}</Text><strong>{Number(item.count).toLocaleString()}</strong></span>
                    <span className="system-log-top-track"><i style={{ width: `${Math.max(5, (Number(item.count) / maximum) * 100)}%` }} /></span>
                  </span>
                  <span className="system-log-top-meta">
                    <small>{Math.round(item.averageDurationMs)} мс</small>
                    {item.errorCount > 0 && <Tag color="red">{item.errorCount} алдаа</Tag>}
                  </span>
                </button>
              );
            }) : <Text type="secondary">Мэдээлэл алга</Text>}
          </Card>
        </Col>
      </Row>

      <Card className="system-log-filter-card" title="Нарийвчилсан шүүлтүүр">
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} md={12} xl={6}>
            <label>API зам</label>
            <Input allowClear value={draftFilters.path} placeholder="Жишээ: /get/Items" onChange={(event) => setDraftFilters((current) => ({ ...current, path: event.target.value }))} onPressEnter={applyFilters} />
          </Col>
          <Col xs={12} md={6} xl={3}>
            <label>Method</label>
            <Select allowClear value={draftFilters.method || undefined} placeholder="Бүгд" options={["GET", "POST", "PUT", "PATCH", "DELETE"].map((value) => ({ value, label: value }))} onChange={(method = "") => setDraftFilters((current) => ({ ...current, method }))} />
          </Col>
          <Col xs={12} md={6} xl={3}>
            <label>Төлөвийн бүлэг</label>
            <Select allowClear value={draftFilters.level || undefined} placeholder="Бүгд" options={[{ value: "info", label: "Амжилттай" }, { value: "warning", label: "4xx алдаа" }, { value: "error", label: "5xx алдаа" }]} onChange={(level = "") => setDraftFilters((current) => ({ ...current, level }))} />
          </Col>
          <Col xs={12} md={6} xl={2}>
            <label>Status</label>
            <InputNumber min={100} max={599} value={draftFilters.statusCode} placeholder="200" onChange={(statusCode) => setDraftFilters((current) => ({ ...current, statusCode }))} />
          </Col>
          <Col xs={12} md={6} xl={2}>
            <label>User ID</label>
            <InputNumber min={1} value={draftFilters.userId} placeholder="ID" onChange={(userId) => setDraftFilters((current) => ({ ...current, userId }))} />
          </Col>
          <Col xs={12} md={6} xl={3}>
            <label>IP хаяг</label>
            <Input allowClear value={draftFilters.ipAddress} placeholder="192.168..." onChange={(event) => setDraftFilters((current) => ({ ...current, ipAddress: event.target.value }))} onPressEnter={applyFilters} />
          </Col>
          <Col xs={12} md={6} xl={2}>
            <label>Орчин</label>
            <Select allowClear value={draftFilters.environment || undefined} placeholder="Бүгд" options={[{ value: "prod", label: "prod" }, { value: "test", label: "test" }]} onChange={(environment = "") => setDraftFilters((current) => ({ ...current, environment }))} />
          </Col>
          <Col xs={12} md={6} xl={3}>
            <label>Гүйцэтгэл</label>
            <div className="system-log-slow-switch">
              <Switch checked={draftFilters.slowOnly} onChange={(slowOnly) => setDraftFilters((current) => ({ ...current, slowOnly }))} />
              <span>Зөвхөн удаан</span>
            </div>
          </Col>
          <Col xs={24} xl={5}>
            <Space className="system-log-filter-actions">
              <Button type="primary" icon={<SearchOutlined />} onClick={applyFilters}>Шүүх</Button>
              <Button onClick={resetFilters}>Цэвэрлэх</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card className="system-log-table-card">
        <div className="system-log-table-title">
          <div><strong>Хүсэлтийн бүртгэл</strong><Text type="secondary">{pagination.total.toLocaleString()} үр дүн</Text></div>
          <Text type="secondary">Мөр дээр дарж дэлгэрэнгүй мэдээлэл харна</Text>
        </div>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          size="middle"
          scroll={{ x: 1380 }}
          rowClassName={(record) => record.statusCode >= 500 ? "system-log-row is-error" : record.statusCode >= 400 ? "system-log-row is-warning" : "system-log-row"}
          onRow={(record) => ({ onClick: () => setSelectedLog(record) })}
          pagination={{ ...pagination, showSizeChanger: true, pageSizeOptions: [25, 50, 100], showTotal: (total) => `Нийт ${total.toLocaleString()}` }}
          onChange={(nextPagination) => loadLogs(nextPagination.current, nextPagination.pageSize)}
        />
      </Card>

      <Drawer title="Хүсэлтийн дэлгэрэнгүй" width={560} open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} className="system-log-drawer" extra={selectedLog && <Tag color={statusColor(selectedLog.statusCode)}>{selectedLog.statusCode} · {statusLabel(selectedLog.statusCode)}</Tag>}>
        {selectedLog && (
          <>
            <div className="system-log-drawer-hero">
              <Tag color={methodColor[selectedLog.method] || "default"}>{selectedLog.method}</Tag>
              <Paragraph copyable={{ text: selectedLog.path }}>{selectedLog.path}</Paragraph>
              <Text type="secondary">{dayjs(selectedLog.createdAt).format("YYYY.MM.DD HH:mm:ss")}</Text>
            </div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Хугацаа">{formatDuration(selectedLog.durationMs)} {selectedLog.durationMs >= 1000 && <Tag color="orange">Удаан</Tag>}</Descriptions.Item>
              <Descriptions.Item label="Хэрэглэгч">{selectedLog.actorName || (selectedLog.userId ? `Хэрэглэгч #${selectedLog.userId}` : "Систем / API")}</Descriptions.Item>
              <Descriptions.Item label="User ID">{selectedLog.userId || "—"}</Descriptions.Item>
              <Descriptions.Item label="Эрхийн төрөл">{selectedLog.userRole || "—"}</Descriptions.Item>
              <Descriptions.Item label="IP хаяг">{selectedLog.ipAddress || "—"}</Descriptions.Item>
              <Descriptions.Item label="Орчин">{selectedLog.environment || "—"}</Descriptions.Item>
              <Descriptions.Item label="Request ID">
                <Space><Text code>{selectedLog.requestId}</Text><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyText(selectedLog.requestId, "Request ID")} /></Space>
              </Descriptions.Item>
            </Descriptions>
            <div className="system-log-agent"><Text strong>User agent</Text><Paragraph>{selectedLog.userAgent || "Мэдээлэл алга"}</Paragraph></div>
          </>
        )}
      </Drawer>
    </div>
  );
}
