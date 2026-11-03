import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Input, Segmented, Statistic, Table, Tag, Typography, message } from "antd";
import { DownloadOutlined, FileDoneOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import axios from "axios";

const { Text, Title } = Typography;
const years = ["2025", "2026", "2027"];
const money = (value) => value == null ? "—" : Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
const display = (value) => value === null || value === undefined || value === "" ? "—" : value;

const reportFields = [
  ["tenderSpecialist", "ХАА-ны мэргэжилтэн"],
  ["contractSpecialist", "Гэрээний мэргэжилтэн"],
  ["supplier", "Нийлүүлэгч"],
  ["sourceTenderNumber", "Эх тендер"],
  ["contractNumber", "Гэрээний нэр"],
  ["contractDate", "Гэрээ байгуулсан огноо"],
  ["customerDepartment", "Захиалагч алба"],
  ["planName", "Төлөвлөгөө"],
  ["tenderName", "Тендерийн нэр"],
  ["currency", "Валют"],
  ["contractAmount", "Гэрээний дүн"],
  ["penaltyCondition", "Алдангийн нөхцөл"],
  ["plannedDeliveryDate", "Нийлүүлэх огноо"],
  ["deliveryTermDays", "Нийлүүлэх хугацаа (хоног)"],
  ["plannedDeliveryAmount", "Нийлүүлэх дүн"],
  ["lastDeliveryDate", "Нийлүүлсэн огноо"],
  ["deliveredAmount", "Нийлүүлсэн дүн"],
  ["deliveryPercent", "Нийлүүлэлтийн гүйцэтгэл %"],
  ["deliveryDelayDays", "Нийлүүлэлтийн хоцролт (хоног)"],
  ["deliveryPenalty", "Нийлүүлэлтийн алданги"],
  ["plannedPaymentDate", "Төлбөр төлөх огноо"],
  ["plannedPaymentAmount", "Төлбөр төлөх дүн"],
  ["paidDate", "Төлбөр төлсөн огноо"],
  ["paidAmount", "Төлсөн дүн"],
  ["paymentPercent", "Төлбөрийн гүйцэтгэл %"],
  ["paymentDelayDays", "Төлбөрийн хоцролт (хоног)"],
  ["paymentPenalty", "Төлбөрийн алданги"],
  ["penaltyPaid", "Алданги төлсөн дүн"],
  ["penaltyPaidDate", "Алданги төлсөн огноо"],
];

const moneyFields = new Set([
  "contractAmount", "plannedDeliveryAmount", "deliveredAmount", "deliveryPenalty",
  "plannedPaymentAmount", "paidAmount", "paymentPenalty", "penaltyPaid",
]);
const percentFields = new Set(["deliveryPercent", "paymentPercent"]);

const makeColumn = (field, title) => ({
  title,
  key: field,
  dataIndex: field,
  width: field === "tenderName" || field === "supplier" ? 200 : 156,
  ellipsis: true,
  render: (value, record) => {
    if (value === null || value === undefined || value === "") return <Text type="secondary">—</Text>;
    if (percentFields.has(field)) {
      return <Tag color={value >= 100 ? "green" : value > 0 ? "blue" : "default"}>{value}%</Tag>;
    }
    if (field === "deliveryDelayDays") {
      return value > 0 ? <Tag color="volcano">{value} хоног</Tag> : "0";
    }
    if (moneyFields.has(field)) {
      return <span className="contract-report-money">{money(value)}{record.currency ? ` ${record.currency}` : ""}</span>;
    }
    return display(value);
  },
});

const columns = [
  { title: "№", key: "index", width: 58, fixed: "left", render: (_, __, index) => index + 1 },
  {
    ...makeColumn("sourceTenderNumber", "Эх тендер"),
    fixed: "left",
    width: 175,
    render: (value) => <Text strong>{display(value)}</Text>,
  },
  { title: "Гэрээний мэдээлэл", children: [
    ...reportFields.slice(0, 3).map(([field, title]) => makeColumn(field, title)),
    ...reportFields.slice(4, 12).map(([field, title]) => makeColumn(field, title)),
  ] },
  { title: "Бараа нийлүүлэлт", children: reportFields.slice(12, 20).map(([field, title]) => makeColumn(field, title)) },
  { title: "Төлбөр төлөлт", children: reportFields.slice(20, 27).map(([field, title]) => makeColumn(field, title)) },
  { title: "Алданги", children: reportFields.slice(27).map(([field, title]) => makeColumn(field, title)) },
];

const ContractReport = () => {
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [search, setSearch] = useState("");
  const [report, setReport] = useState({ rows: [], asOf: "" });
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const loadReport = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/get/ContractReport`, { params: { year } });
      if (currentRequest !== requestId.current) return;
      setReport({
        rows: Array.isArray(response.data?.rows) ? response.data.rows : [],
        asOf: response.data?.asOf || "",
      });
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setReport({ rows: [], asOf: "" });
      message.error(error.response?.data?.error || "Гэрээний тайлан татахад алдаа гарлаа");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [API_BASE_URL, year]);

  useEffect(() => {
    loadReport();
    return () => { requestId.current += 1; };
  }, [loadReport]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("mn-MN");
    if (!keyword) return report.rows;
    return report.rows.filter((row) =>
      [row.sourceTenderNumber, row.contractNumber, row.tenderName, row.supplier, row.contractSpecialist, row.tenderSpecialist]
        .some((value) => String(value || "").toLocaleLowerCase("mn-MN").includes(keyword))
    );
  }, [report.rows, search]);

  const totals = useMemo(() => filteredRows.reduce((result, row) => {
    if (!row.currency || row.currency.toUpperCase() === "MNT") {
      result.contractAmount += Number(row.contractAmount) || 0;
      result.deliveredAmount += Number(row.deliveredAmount) || 0;
    }
    if (row.lastDeliveryDate) result.withArrivals += 1;
    return result;
  }, { contractAmount: 0, deliveredAmount: 0, withArrivals: 0 }), [filteredRows]);

  const exportCsv = () => {
    const escapeCell = (value) => {
      const safe = /^[=+@-]/.test(String(value ?? "")) ? `'${value}` : String(value ?? "");
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const lines = [
      ["№", ...reportFields.map(([, title]) => title)],
      ...filteredRows.map((row, index) => [index + 1, ...reportFields.map(([field]) => row[field] ?? "")]),
    ];
    const csv = new Blob(["\uFEFF", lines.map((line) => line.map(escapeCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(csv);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Гэрээний-гүйцэтгэлийн-тайлан-${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="procurement-report-page contract-report-page">
      <section className="report-heading">
        <div>
          <div className="report-eyebrow">ГЭРЭЭНИЙ ГҮЙЦЭТГЭЛИЙН ТАЙЛАН</div>
          <Title level={2}>Гэрээ, нийлүүлэлт, төлбөрийн мэдээлэл</Title>
          <Text type="secondary">Гэрээг бүртгэсэн оноор шүүнэ. Одоогоор бүртгэгдсэн мэдээллийг харуулна.</Text>
        </div>
        <div className="contract-report-actions">
          <Segmented value={year} onChange={setYear} options={years} />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadReport}>Шинэчлэх</Button>
          <Button type="primary" icon={<DownloadOutlined />} disabled={!filteredRows.length} onClick={exportCsv}>CSV татах</Button>
        </div>
      </section>

      <Alert
        className="report-summary-note"
        type="info"
        showIcon
        message="Нийлүүлсэн дүн ба хувь нь сагсны барааны үнэ, бүртгэсэн ирэлтийн тооноос тооцоологдоно."
        description="Нийлүүлэх хугацаа нь хоногоор бүртгэгддэг тул эхлэх өдрийг таамаглан хугацаа хэтэрснийг тооцохгүй. Төлбөр болон алдангийн бодит төлөлт бүртгэгдээгүй талбаруудыг — гэж харуулна. Гадаад валютын нийлүүлсэн дүнг хөрвүүлэлтгүйгээр тооцохгүй."
      />

      <div className="contract-report-stats">
        <Card><Statistic title="Гэрээ" value={filteredRows.length} prefix={<FileDoneOutlined />} /></Card>
        <Card><Statistic title="Гэрээний дүн (MNT)" value={totals.contractAmount} precision={0} /></Card>
        <Card><Statistic title="Нийлүүлсэн дүн (MNT, тооцоолсон)" value={totals.deliveredAmount} precision={0} /></Card>
        <Card><Statistic title="Ирэлт бүртгэсэн гэрээ" value={totals.withArrivals} /></Card>
      </div>

      <Card className="report-table-card" styles={{ body: { padding: 0 } }}>
        <div className="report-table-toolbar">
          <div>
            <Title level={4}>Гэрээний бүртгэл</Title>
            <Text type="secondary">{report.asOf ? `Шинэчилсэн: ${report.asOf}` : "Одоогийн мэдээлэл"} · Хүснэгтийг баруун тийш гүйлгэнэ</Text>
          </div>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Гэрээ, тендер, нийлүүлэгч, мэргэжилтэн" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Table
          rowKey="contractId"
          columns={columns}
          dataSource={filteredRows}
          loading={loading}
          size="small"
          bordered
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} гэрээ` }}
          scroll={{ x: 3700 }}
          locale={{ emptyText: "Энэ онд гэрээ олдсонгүй" }}
        />
      </Card>
    </div>
  );
};

export default ContractReport;
