import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Modal, Table, Tag, Typography } from "antd";
import {
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import axios from "axios";
import PropTypes from "prop-types";
import { fetchOrders } from "../../api/orders";
import { normalizeExternalOrder } from "../Бүртгэл/order.utils";

const { Text } = Typography;
const API_BASE_URL = import.meta.env.VITE_API_URL;

const unwrap = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return value;
  for (const key of ["String", "Int64", "Float64", "Bool", "Time", "Value", "value"]) {
    if (value[key] !== undefined && value[key] !== null) return unwrap(value[key]);
  }
  return "";
};

const normalizeText = (value) => String(unwrap(value) ?? "").trim();
const normalizeKeyText = (value) => normalizeText(value).toLocaleLowerCase("mn-MN");
const normalizeDate = (value) => {
  const text = normalizeText(value).split(/[T ]/)[0];
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : text;
};
const normalizeNumber = (value) => {
  const number = Number(normalizeText(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
};
const parseBasketIds = (value) => [...new Set(
  (Array.isArray(value) ? value : String(value || "").split(","))
    .map((item) => String(item).trim())
    .filter(Boolean)
)];

const buildStableKey = (item) => [
  item.pkgno,
  normalizeDate(item.pkgdate),
  item.rid,
  item.acct,
  item.code,
  item.dcode,
  item.dname,
  item.mdocno,
  item.zno,
].map(normalizeKeyText).join("|");

const buildFallbackKey = (item) => [
  item.pkgno,
  normalizeDate(item.pkgdate),
  item.code,
  item.dcode,
  item.dname,
].map(normalizeKeyText).join("|");

const comparisonFields = [
  { key: "rid", label: "RID", normalize: normalizeKeyText },
  { key: "acct", label: "Данс / атрибут", normalize: normalizeKeyText },
  { key: "mdocno", label: "Баримтын дугаар", normalize: normalizeKeyText },
  { key: "zno", label: "Зургийн дугаар", normalize: normalizeKeyText },
  { key: "qty", label: "Тоо хэмжээ", normalize: normalizeNumber },
  { key: "price", label: "Нэгж үнэ", normalize: normalizeNumber },
  { key: "pkgname", label: "Багцын нэр", normalize: normalizeKeyText },
  { key: "cr4name", label: "Барааны нэр", normalize: normalizeKeyText },
  { key: "crmarkname", label: "Марк", normalize: normalizeKeyText },
  { key: "crbrandname", label: "Брэнд", normalize: normalizeKeyText },
  { key: "mname", label: "Хэмжих нэгж", normalize: normalizeKeyText },
  { key: "deathdate", label: "Шаардагдах огноо", normalize: normalizeDate },
];

const indexRecords = (records, keyBuilder) => {
  const index = new Map();
  records.forEach((record) => {
    const key = keyBuilder(record);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(record);
  });
  return index;
};

const findBestCandidate = (localItem, candidates = []) => {
  if (!candidates.length) return null;
  return [...candidates].sort((first, second) => {
    const firstDifferenceCount = comparisonFields.filter(
      (field) => field.normalize(localItem[field.key]) !== field.normalize(first[field.key])
    ).length;
    const secondDifferenceCount = comparisonFields.filter(
      (field) => field.normalize(localItem[field.key]) !== field.normalize(second[field.key])
    ).length;
    return firstDifferenceCount - secondDifferenceCount;
  })[0];
};

const auditItems = (localItems, externalItems) => {
  const stableIndex = indexRecords(externalItems, buildStableKey);
  const fallbackIndex = indexRecords(externalItems, buildFallbackKey);

  return localItems.map((item, index) => {
    const stableCandidates = stableIndex.get(buildStableKey(item)) || [];
    const candidates = stableCandidates.length
      ? stableCandidates
      : fallbackIndex.get(buildFallbackKey(item)) || [];
    const source = findBestCandidate(item, candidates);
    if (!source) {
      return {
        ...item,
        auditKey: `missing-${item.basket_item_id || index}`,
        auditStatus: "missing",
        differences: [],
      };
    }

    const differences = comparisonFields.flatMap((field) => {
      const localValue = field.normalize(item[field.key]);
      const sourceValue = field.normalize(source[field.key]);
      if (localValue === sourceValue) return [];
      return [{
        field: field.label,
        localValue: normalizeText(item[field.key]) || "—",
        sourceValue: normalizeText(source[field.key]) || "—",
      }];
    });

    return {
      ...item,
      auditKey: `found-${item.basket_item_id || index}`,
      auditStatus: differences.length ? "changed" : "valid",
      differences,
    };
  });
};

const getOrderYears = (items, record) => {
  const years = new Set();
  items.forEach((item) => {
    [item.pkgdate, item.ddate, item.cdate].forEach((value) => {
      const match = normalizeText(value).match(/^(\d{4})[-/]/);
      if (match) years.add(match[1]);
    });
  });
  if (!years.size) {
    const fallback = normalizeText(record?.тендер_нээх_огноо || record?.created_at).match(/^(\d{4})[-/]/)?.[1];
    years.add(fallback || String(new Date().getFullYear()));
  }
  return [...years];
};

const TenderOrderAuditModal = ({ open, record, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [years, setYears] = useState([]);
  const [error, setError] = useState("");
  const basketIds = useMemo(() => parseBasketIds(record?.basket_ids), [record?.basket_ids]);

  const runAudit = useCallback(async () => {
    if (!basketIds.length) {
      setRows([]);
      setError("Энэ тендерт шалгах багц алга.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const basketResponse = await axios.get(`${API_BASE_URL}/get/GetBasketItemsById/${basketIds.join(",")}`);
      const localItems = Array.isArray(basketResponse.data) ? basketResponse.data : [];
      const auditYears = getOrderYears(localItems, record);
      const responses = await Promise.all(
        auditYears.map((year) => fetchOrders(year, "0", "server-managed", { audit: true }))
      );
      const externalItems = responses.flatMap((response, index) => {
        if (!response.data?.status) {
          throw new Error(response.data?.message || `${auditYears[index]} оны захиалгын мэдээлэл ирсэнгүй`);
        }
        return (response.data.records || []).map(normalizeExternalOrder);
      });

      setYears(auditYears);
      setRows(auditItems(localItems, externalItems));
    } catch (auditError) {
      console.error("Tender order audit failed:", auditError);
      setRows([]);
      setError(auditError?.response?.data?.error || auditError?.message || "Захиалгыг шалгаж чадсангүй");
    } finally {
      setLoading(false);
    }
  }, [basketIds, record]);

  useEffect(() => {
    if (open) runAudit();
    else {
      setRows([]);
      setYears([]);
      setError("");
    }
  }, [open, runAudit]);

  const summary = useMemo(() => rows.reduce((result, row) => ({
    ...result,
    [row.auditStatus]: result[row.auditStatus] + 1,
  }), { valid: 0, changed: 0, missing: 0 }), [rows]);

  const columns = [
    {
      title: "Төлөв",
      dataIndex: "auditStatus",
      key: "auditStatus",
      width: 125,
      render: (status) => status === "valid"
        ? <Tag icon={<CheckCircleOutlined />} color="success">Хүчинтэй</Tag>
        : status === "changed"
          ? <Tag icon={<WarningOutlined />} color="warning">Зөрүүтэй</Tag>
          : <Tag icon={<CloseCircleOutlined />} color="error">Олдсонгүй</Tag>,
    },
    {
      title: "Багц",
      key: "package",
      width: 230,
      render: (_, row) => (
        <div className="tender-audit-cell">
          <strong>{row.basket_name || row.pkgname || "Нэргүй багц"}</strong>
          <span>{row.pkgno || "Дугааргүй"} · {normalizeDate(row.pkgdate) || "Огноогүй"}</span>
        </div>
      ),
    },
    {
      title: "Захиалга",
      key: "order",
      render: (_, row) => (
        <div className="tender-audit-cell">
          <strong>{row.cr4name || "Нэргүй бараа"}</strong>
          <span>{[row.crmarkname, row.crbrandname].filter(Boolean).join(" · ") || "—"}</span>
        </div>
      ),
    },
    { title: "Код", dataIndex: "code", key: "code", width: 145 },
    { title: "Захиалагч", dataIndex: "dname", key: "dname", width: 130 },
    {
      title: "Шалгалтын тайлбар",
      key: "differences",
      width: 290,
      render: (_, row) => {
        if (row.auditStatus === "valid") return <Text type="success">API мэдээлэлтэй тохирч байна</Text>;
        if (row.auditStatus === "missing") return <Text type="danger">/v1/orders/list мэдээллээс олдсонгүй</Text>;
        return (
          <div className="tender-audit-differences">
            {row.differences.map((difference) => (
              <span key={difference.field}>
                <strong>{difference.field}:</strong> {difference.localValue} → {difference.sourceValue}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  const allValid = rows.length > 0 && summary.valid === rows.length;

  return (
    <Modal
      open={open}
      title={<span className="tender-audit-title"><AuditOutlined /> Захиалгын эх үүсвэрийн шалгалт</span>}
      width="min(1320px, 96vw)"
      centered
      destroyOnHidden
      onCancel={onClose}
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={runAudit} loading={loading}>Дахин шалгах</Button>,
        <Button key="close" type="primary" onClick={onClose}>Хаах</Button>,
      ]}
    >
      <Alert
        type={error ? "error" : allValid ? "success" : "info"}
        showIcon
        message={error || (allValid
          ? "Тендерийн бүх захиалга эх API мэдээлэлтэй тохирч байна"
          : "Хүчинтэй, зөрүүтэй болон эх мэдээллээс олдоогүй захиалгыг харуулна")}
        description={!error && years.length ? `Шалгасан он: ${years.join(", ")} · Эх үүсвэр: /v1/orders/list` : undefined}
        className="tender-audit-alert"
      />
      <div className="tender-audit-summary">
        <div><span>Нийт</span><strong>{rows.length}</strong></div>
        <div className="is-valid"><span>Хүчинтэй</span><strong>{summary.valid}</strong></div>
        <div className="is-changed"><span>Зөрүүтэй</span><strong>{summary.changed}</strong></div>
        <div className="is-missing"><span>Олдсонгүй</span><strong>{summary.missing}</strong></div>
      </div>
      <Table
        rowKey="auditKey"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: [15, 30, 50] }}
        scroll={{ x: 1150, y: "min(480px, 52vh)" }}
        size="small"
        rowClassName={(row) => `tender-audit-row is-${row.auditStatus}`}
      />
    </Modal>
  );
};

TenderOrderAuditModal.propTypes = {
  open: PropTypes.bool.isRequired,
  record: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};

export default TenderOrderAuditModal;
