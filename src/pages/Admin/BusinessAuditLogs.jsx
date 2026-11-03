import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileAddOutlined,
  HistoryOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { fetchBusinessAuditLogs } from "../../api/businessAudit";
import "./BusinessAuditLogs.css";

const { RangePicker } = DatePicker;
const { Paragraph, Text, Title } = Typography;

const actionMeta = {
  CREATE: { label: "Үүсгэсэн", color: "green", icon: <FileAddOutlined /> },
  UPDATE: { label: "Зассан", color: "blue", icon: <EditOutlined /> },
  DELETE: { label: "Устгасан", color: "red", icon: <DeleteOutlined /> },
  RETURN: { label: "Буцаасан", color: "orange", icon: <RollbackOutlined /> },
  REANNOUNCE: { label: "Дахин зарласан", color: "purple", icon: <HistoryOutlined /> },
  ASSIGN: { label: "Хуваарилсан", color: "cyan", icon: <HistoryOutlined /> },
  UNASSIGN: { label: "Хуваарилалт цуцалсан", color: "gold", icon: <RollbackOutlined /> },
};

const entityLabels = {
  Tender: "Тендер",
  Geree: "Гэрээ",
  Basket: "Багц",
  Plan: "Төлөвлөгөө",
  CposCode: "Хэмжих нэгж",
};

const periodRange = (period) => {
  if (period === "today") return [dayjs(), dayjs()];
  if (period === "30") return [dayjs().subtract(29, "day"), dayjs()];
  return [dayjs().subtract(6, "day"), dayjs()];
};

const createFilters = () => ({
  dateRange: periodRange("7"),
  search: "",
  action: "",
  entityType: "",
  entityId: "",
  userId: null,
});

const initialSummary = { total: 0, created: 0, updated: 0, deleted: 0, returned: 0 };

const parseAuditValue = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const displayAuditValue = (value) => {
  const parsed = parseAuditValue(value);
  if (parsed === null || parsed === "") return "—";
  return typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : String(parsed);
};

const shortValue = (value) => {
  const text = displayAuditValue(value).replaceAll("\n", " ");
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
};

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function BusinessAuditLogs() {
  const initialFilters = useMemo(createFilters, []);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [period, setPeriod] = useState("7");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });

  const loadAudit = useCallback(async (page = 1, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const [from, to] = filters.dateRange || [];
      const payload = await fetchBusinessAuditLogs({
        page,
        pageSize,
        from: from?.format("YYYY-MM-DD"),
        to: to?.format("YYYY-MM-DD"),
        search: filters.search || undefined,
        action: filters.action || undefined,
        entityType: filters.entityType || undefined,
        entityId: filters.entityId || undefined,
        userId: filters.userId || undefined,
      });
      setRows(Array.isArray(payload?.rows) ? payload.rows : []);
      setSummary(payload?.summary || initialSummary);
      setPagination({ current: page, pageSize, total: Number(payload?.total) || 0 });
      setLastUpdated(payload?.generatedAt ? dayjs(payload.generatedAt) : dayjs());
    } catch (error) {
      console.error("Business audit loading failed:", error);
      message.error(error.response?.status === 403
        ? "Бизнес аудит харах эрхгүй байна"
        : "Бизнес аудит татаж чадсангүй");
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.pageSize]);

  useEffect(() => {
    loadAudit(1, pagination.pageSize);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => {
    setPagination((current) => ({ ...current, current: 1 }));
    setFilters({ ...draftFilters });
  };

  const selectPeriod = (value) => {
    setPeriod(value);
    if (value === "custom") return;
    const next = { ...draftFilters, dateRange: periodRange(value) };
    setDraftFilters(next);
    setFilters(next);
  };

  const resetFilters = () => {
    const next = createFilters();
    setPeriod("7");
    setDraftFilters(next);
    setFilters(next);
  };

  const copyText = async (value, label) => {
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
    const header = ["Огноо", "Үйлдэл", "Объект", "ID", "Талбар", "Өмнөх", "Шинэ", "Тайлбар", "Хэрэглэгч", "User ID", "Request ID"];
    const body = rows.map((record) => [
      dayjs(record.createdAt).format("YYYY-MM-DD HH:mm:ss"), record.action,
      record.entityType, record.entityId, record.fieldName, record.oldValue,
      record.newValue, record.comment, record.actorName, record.userId, record.requestId,
    ].map(csvCell).join(","));
    const blob = new Blob([`\ufeff${header.map(csvCell).join(",")}\n${body.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `business-audit-${dayjs().format("YYYYMMDD-HHmm")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo(() => [
    {
      title: "Огноо",
      dataIndex: "createdAt",
      width: 150,
      fixed: "left",
      render: (value) => (
        <div className="business-audit-date">
          <strong>{dayjs(value).format("YYYY.MM.DD")}</strong>
          <span>{dayjs(value).format("HH:mm:ss")}</span>
        </div>
      ),
    },
    {
      title: "Үйлдэл",
      dataIndex: "action",
      width: 145,
      render: (value) => {
        const meta = actionMeta[value] || { label: value, color: "default" };
        return <Tag color={meta.color} icon={meta.icon}>{meta.label}</Tag>;
      },
    },
    {
      title: "Объект",
      key: "entity",
      width: 170,
      render: (_, record) => (
        <div className="business-audit-entity">
          <strong>{entityLabels[record.entityType] || record.entityType}</strong>
          <span>#{record.entityId}</span>
        </div>
      ),
    },
    {
      title: "Өөрчлөлт",
      key: "change",
      width: 410,
      render: (_, record) => (
        <div className="business-audit-change">
          {record.fieldName && <Text className="business-audit-field">{record.fieldName}</Text>}
          <div className="business-audit-values">
            <span className="before">{shortValue(record.oldValue)}</span>
            <span className="arrow">→</span>
            <span className="after">{shortValue(record.newValue)}</span>
          </div>
          {record.comment && <Text type="secondary" ellipsis>{record.comment}</Text>}
        </div>
      ),
    },
    {
      title: "Хэрэглэгч",
      key: "actor",
      width: 200,
      render: (_, record) => (
        <div className="business-audit-actor">
          <strong>{record.actorName || `Хэрэглэгч #${record.userId || "—"}`}</strong>
          <span>{record.userRole || "Эрх тодорхойгүй"} · ID {record.userId || "—"}</span>
        </div>
      ),
    },
  ], []);

  return (
    <div className="business-audit-page">
      <div className="business-audit-heading">
        <div>
          <Space size={10} align="center">
            <span className="business-audit-heading-icon"><HistoryOutlined /></span>
            <Title level={3}>Бизнес аудит</Title>
          </Space>
          <Paragraph>Тендер, гэрээ, багц болон тохиргоонд хэн, хэзээ, ямар өөрчлөлт хийснийг шалгана.</Paragraph>
        </div>
        <Space>
          <Text type="secondary">{lastUpdated ? `Шинэчилсэн ${lastUpdated.format("HH:mm:ss")}` : ""}</Text>
          <Button icon={<DownloadOutlined />} onClick={exportCurrentPage}>CSV</Button>
          <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={() => loadAudit(pagination.current, pagination.pageSize)}>Шинэчлэх</Button>
        </Space>
      </div>

      <Row gutter={[14, 14]} className="business-audit-summary">
        {[
          { title: "Нийт үйлдэл", value: summary.total, tone: "total" },
          { title: "Үүсгэсэн", value: summary.created, tone: "create" },
          { title: "Зассан", value: summary.updated, tone: "update" },
          { title: "Устгасан", value: summary.deleted, tone: "delete" },
          { title: "Буцаасан", value: summary.returned, tone: "return" },
        ].map((item) => (
          <Col flex="1 1 170px" key={item.tone}>
            <Card className={`business-audit-stat ${item.tone}`} styles={{ body: { padding: 18 } }}>
              <Statistic title={item.title} value={item.value} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="business-audit-filter" styles={{ body: { padding: 18 } }}>
        <div className="business-audit-filter-top">
          <Segmented
            value={period}
            onChange={selectPeriod}
            options={[
              { label: "Өнөөдөр", value: "today" },
              { label: "7 хоног", value: "7" },
              { label: "30 хоног", value: "30" },
              { label: "Өөр хугацаа", value: "custom" },
            ]}
          />
          <RangePicker
            value={draftFilters.dateRange}
            format="YYYY.MM.DD"
            onChange={(value) => {
              setPeriod("custom");
              setDraftFilters((current) => ({ ...current, dateRange: value }));
            }}
          />
        </div>
        <div className="business-audit-filter-grid">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Объект, талбар, тайлбараар хайх"
            value={draftFilters.search}
            onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
            onPressEnter={applyFilters}
          />
          <Select
            allowClear
            placeholder="Үйлдэл"
            value={draftFilters.action || undefined}
            onChange={(value) => setDraftFilters((current) => ({ ...current, action: value || "" }))}
            options={Object.entries(actionMeta).map(([value, meta]) => ({ value, label: meta.label }))}
          />
          <Select
            allowClear
            showSearch
            placeholder="Объектын төрөл"
            value={draftFilters.entityType || undefined}
            onChange={(value) => setDraftFilters((current) => ({ ...current, entityType: value || "" }))}
            options={Object.entries(entityLabels).map(([value, label]) => ({ value, label }))}
          />
          <Input
            allowClear
            placeholder="Объектын ID"
            value={draftFilters.entityId}
            onChange={(event) => setDraftFilters((current) => ({ ...current, entityId: event.target.value }))}
            onPressEnter={applyFilters}
          />
          <InputNumber
            min={1}
            controls={false}
            placeholder="Хэрэглэгчийн ID"
            value={draftFilters.userId}
            onChange={(value) => setDraftFilters((current) => ({ ...current, userId: value }))}
          />
          <Space className="business-audit-filter-actions">
            <Button onClick={resetFilters}>Цэвэрлэх</Button>
            <Button type="primary" icon={<SearchOutlined />} onClick={applyFilters}>Шүүх</Button>
          </Space>
        </div>
      </Card>

      <Card className="business-audit-table" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <Empty description="Сонгосон нөхцөлд аудитын мэдээлэл алга" /> }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            pageSizeOptions: [10, 25, 50, 100],
            showTotal: (total) => `Нийт ${total} үйлдэл`,
          }}
          onChange={(next) => loadAudit(next.current, next.pageSize)}
          onRow={(record) => ({ onClick: () => setSelectedAudit(record) })}
          rowClassName="business-audit-row"
        />
      </Card>

      <Drawer
        title="Өөрчлөлтийн дэлгэрэнгүй"
        width={620}
        open={Boolean(selectedAudit)}
        onClose={() => setSelectedAudit(null)}
      >
        {selectedAudit && (
          <div className="business-audit-detail">
            <div className="business-audit-detail-title">
              <Tag color={actionMeta[selectedAudit.action]?.color || "default"}>
                {actionMeta[selectedAudit.action]?.label || selectedAudit.action}
              </Tag>
              <Title level={4}>{entityLabels[selectedAudit.entityType] || selectedAudit.entityType} #{selectedAudit.entityId}</Title>
              <Text type="secondary">{dayjs(selectedAudit.createdAt).format("YYYY.MM.DD HH:mm:ss")}</Text>
            </div>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Хэрэглэгч">{selectedAudit.actorName || "—"} · ID {selectedAudit.userId || "—"}</Descriptions.Item>
              <Descriptions.Item label="Эрх">{selectedAudit.userRole || "—"}</Descriptions.Item>
              <Descriptions.Item label="Талбар">{selectedAudit.fieldName || "Ерөнхий мэдээлэл"}</Descriptions.Item>
              <Descriptions.Item label="IP хаяг">{selectedAudit.ipAddress || "—"}</Descriptions.Item>
              <Descriptions.Item label="Request ID">
                <Space>
                  <Text code>{selectedAudit.requestId || "—"}</Text>
                  {selectedAudit.requestId && <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyText(selectedAudit.requestId, "Request ID")} />}
                </Space>
              </Descriptions.Item>
            </Descriptions>
            {selectedAudit.comment && (
              <Card size="small" title="Тайлбар"><Paragraph>{selectedAudit.comment}</Paragraph></Card>
            )}
            <div className="business-audit-compare">
              <Card size="small" title="Өмнөх утга" className="before-card">
                <pre>{displayAuditValue(selectedAudit.oldValue)}</pre>
              </Card>
              <Card size="small" title="Шинэ утга" className="after-card">
                <pre>{displayAuditValue(selectedAudit.newValue)}</pre>
              </Card>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
