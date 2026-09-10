import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  DeleteOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  ApartmentOutlined,
  DollarCircleOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  HolderOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import PropTypes from "prop-types";
import BasketItemsDetails from "../Бүртгэл/BasketItemsDetails";
import ContractCreateModal from "./ContractCreateModal";
import TenderReannounceModal from "./TenderReannounceModal";
import { fieldLabels, generalFieldOrder } from "./tender.fields";
import { calcCompletion, isEmpty } from "./tender.utils";
import { formatBudgetAmount, parseBudgetAmount } from "./tender.money";

const { Text } = Typography;
const API_BASE_URL = import.meta.env.VITE_API_URL;

const EXCLUDED_FIELDS = [
  "tender_id", "created_at", "created_by", "тендер_амжилттай_болсон_эсэх",
  "plan_root_number", "tender_name", "тендерийн_дугаар", "тендерт_оролцогч",
  "урилгийн_дугаар", "урилгийн_огноо", "гомдол_гаргасан_огноо",
  "түтгэлзүүлсэн_огноо", "ү_дарга", "ү_гишүүд", "ү_дугаар", "ү_огноо",
  "зүк_дугаар", "зүк_огноо", "basket_ids", "Ovog", "Ner", "root_tender_id",
  "version_no", "is_current", "lifecycle_status", "archived_at",
  "has_returned_contract", "returned_contract_comment", "returned_contract_at", "returned_contract_by",
];

const NIIGEMLEG_FIELDS = ["ү_дугаар", "ү_огноо"];
const LIMITED_FIELDS = [
  "шалгаруулалтын_төрөл",
  "тендерийн_төрөл",
  "батлагдсан_төсөвт_өртөг",
  "гэрээ_байгуулах_эрх_олгосон_огноо",
  "тайлбар",
];

const normalizeRecordForForm = (record) => {
  if (!record) return record;
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (!key.toLocaleLowerCase("mn-MN").includes("огноо")) {
        return [key, value];
      }

      if (!value || String(value).startsWith("1900")) {
        return [key, null];
      }

      const parsedDate = dayjs(value);
      return [key, parsedDate.isValid() ? parsedDate : null];
    })
  );
};

const serializeValue = (value) =>
  dayjs.isDayjs(value) ? value.format("YYYY-MM-DD") : value ?? "";

const TenderModal = ({
  visible,
  record,
  user,
  onClose,
  handleUpdate,
  onSuspend,
  onActivate,
  onDelete,
  hasContract,
  existingContract,
  onContractCreated,
  onReannounced,
}) => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("general");
  const [versionHistory, setVersionHistory] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [reannounceModalOpen, setReannounceModalOpen] = useState(false);
  const [orderEditorOpen, setOrderEditorOpen] = useState(false);
  const [fieldOrder, setFieldOrder] = useState(() => [...generalFieldOrder]);
  const [draftFieldOrder, setDraftFieldOrder] = useState(() => [...generalFieldOrder]);
  const [draggedField, setDraggedField] = useState(null);
  const activeRecord = useMemo(
    () => versionHistory.find((version) => Number(version.tender_id) === Number(selectedVersionId)) || record,
    [record, selectedVersionId, versionHistory]
  );
  const isHistoricalView = Number(activeRecord?.tender_id) !== Number(record?.tender_id);

  const fieldOrderStorageKey = useMemo(() => {
    const userIdentity = user?.id || user?.Id || user?.username || user?.Username || "default";
    return `tender-general-field-order:${userIdentity}`;
  }, [user]);

  const isManagement = user?.erh === "Удирдлага" || user?.Erh === "Удирдлага";
  const tenderType = activeRecord?.тендерийн_төрөл?.trim();
  const ownerName = `${activeRecord?.Ovog || ""} ${activeRecord?.Ner || ""}`.trim() || "Хариуцагчгүй";
  const isEvaluationCommittee = ["НТШ", "ХА"].includes(tenderType);
  const completionMode = isEvaluationCommittee ? "default" : "zuk";
  const isSuspended = !String(activeRecord?.түтгэлзүүлсэн_огноо || "").startsWith("1900");
  const isWaitingExternal = activeRecord?.lifecycle_status === "WaitingExternal";
  const showReturnedContract = !isHistoricalView && Boolean(record?.has_returned_contract);
  const contractSpecialistName = String(
    existingContract?.geree_user_name || ""
  ).trim();
  const completion = useMemo(
    () => calcCompletion(activeRecord, completionMode),
    [activeRecord, completionMode]
  );

  useEffect(() => {
    if (!activeRecord) return;
    form.setFieldsValue(normalizeRecordForForm(activeRecord));
  }, [activeRecord, form]);

  useEffect(() => {
    if (visible && record?.tender_id) setActiveTab("general");
  }, [record?.tender_id, visible]);

  useEffect(() => {
    if (!visible || !record?.tender_id) return;
    let cancelled = false;
    setVersionsLoading(true);
    axios.get(`${API_BASE_URL}/get/GetTenderChainById/${record.tender_id}`)
      .then((response) => {
        if (cancelled) return;
        const versions = Array.isArray(response.data) && response.data.length
          ? response.data
          : [record];
        setVersionHistory(versions);
        const selected = versions.find((version) => Number(version.tender_id) === Number(record.tender_id))
          || versions.find((version) => version.is_current)
          || versions[versions.length - 1];
        setSelectedVersionId(selected?.tender_id ?? record.tender_id);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Tender version history fetch failed:", error);
        setVersionHistory([record]);
        setSelectedVersionId(record.tender_id);
      })
      .finally(() => {
        if (!cancelled) setVersionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [record, visible]);

  useEffect(() => {
    try {
      const savedOrder = JSON.parse(localStorage.getItem(fieldOrderStorageKey) || "[]");
      const validSavedFields = Array.isArray(savedOrder)
        ? savedOrder.filter((field) => generalFieldOrder.includes(field))
        : [];
      const mergedOrder = [
        ...new Set([...validSavedFields, ...generalFieldOrder]),
      ];
      setFieldOrder(mergedOrder);
    } catch {
      setFieldOrder([...generalFieldOrder]);
    }
  }, [fieldOrderStorageKey]);

  const visibleFields = useMemo(() => {
    if (!activeRecord) return [];
    const fields = isEvaluationCommittee
      ? Object.keys(activeRecord).filter((field) => !EXCLUDED_FIELDS.includes(field))
      : LIMITED_FIELDS;
    const order = new Map(fieldOrder.map((field, index) => [field, index]));
    return [...fields].sort((first, second) =>
      (order.get(first) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(second) ?? Number.MAX_SAFE_INTEGER)
    );
  }, [activeRecord, fieldOrder, isEvaluationCommittee]);

  const openOrderEditor = () => {
    setDraftFieldOrder([...fieldOrder]);
    setOrderEditorOpen(true);
  };

  const moveDraftField = (field, offset) => {
    setDraftFieldOrder((current) => {
      const currentIndex = current.indexOf(field);
      const targetIndex = currentIndex + offset;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
      return next;
    });
  };

  const dropDraftField = (targetField) => {
    if (!draggedField || draggedField === targetField) return;
    setDraftFieldOrder((current) => {
      const next = current.filter((field) => field !== draggedField);
      const targetIndex = next.indexOf(targetField);
      next.splice(targetIndex, 0, draggedField);
      return next;
    });
    setDraggedField(null);
  };

  const saveFieldOrder = () => {
    setFieldOrder(draftFieldOrder);
    localStorage.setItem(fieldOrderStorageKey, JSON.stringify(draftFieldOrder));
    setOrderEditorOpen(false);
  };

  const saveField = (field, value) => {
    const serialized = serializeValue(value);
    const current = serializeValue(activeRecord?.[field]);
    if (String(serialized) === String(current)) return;
    handleUpdate(activeRecord.tender_id, field, serialized);
  };

  const renderReadOnly = (field) => {
    const value = activeRecord?.[field];
    if (isEmpty(value)) return <Text type="secondary">—</Text>;
    if (field.includes("огноо")) {
      const date = dayjs(value);
      return date.isValid() ? date.format("YYYY-MM-DD") : value;
    }
    if (field === "батлагдсан_төсөвт_өртөг") {
      return `${formatBudgetAmount(value)} ₮`;
    }
    return String(value);
  };

  const renderField = (field) => {
    if (isManagement || isHistoricalView || isWaitingExternal) return renderReadOnly(field);

    if (field === "батлагдсан_төсөвт_өртөг") {
      return (
        <Form.Item name={field} noStyle>
          <InputNumber
            stringMode
            min="0"
            max="99999999999999999.99"
            precision={2}
            controls={false}
            style={{ width: "100%" }}
            formatter={(value, info) => formatBudgetAmount(info.userTyping ? info.input : value)}
            parser={parseBudgetAmount}
            addonAfter="₮"
            onBlur={() => saveField(field, form.getFieldValue(field) ?? "0")}
            onPressEnter={(event) => {
              event.preventDefault();
              event.currentTarget.blur();
            }}
          />
        </Form.Item>
      );
    }

    if (field === "тендерийн_төрөл") {
      return (
        <Form.Item name={field} noStyle>
          <Select
            style={{ width: "100%", minWidth: 240 }}
            popupMatchSelectWidth={320}
            onChange={(value) => saveField(field, value)}
            options={["НТШ", "ХА", "Нэг эх үүсвэр", "Гэрээ шууд байгуулах"].map(
              (value) => ({ label: value, value })
            )}
          />
        </Form.Item>
      );
    }

    if (field === "шалгаруулалтын_төрөл") {
      return (
        <Form.Item name={field} noStyle>
          <Select
            style={{ width: "100%", minWidth: 240 }}
            popupMatchSelectWidth={320}
            onChange={(value) => saveField(field, value)}
            options={["Бараа", "Ажил үйлчилгээ", "Зөвлөх үйлчилгээ"].map(
              (value) => ({ label: value, value })
            )}
          />
        </Form.Item>
      );
    }

    if (field.includes("огноо")) {
      return (
        <Form.Item name={field} noStyle>
          <DatePicker
            allowClear
            style={{ width: "100%" }}
            onChange={(value) => saveField(field, value)}
          />
        </Form.Item>
      );
    }

    return (
      <Form.Item name={field} noStyle>
        <Input
          onBlur={(event) => saveField(field, event.target.value.trim())}
          onPressEnter={(event) => {
            event.preventDefault();
            saveField(field, event.currentTarget.value.trim());
          }}
        />
      </Form.Item>
    );
  };

  if (!activeRecord) return null;

  const detailList = (fields, className = "") => (
    <Descriptions bordered column={1} size="small" className={className}>
      {fields.map((field) => (
        <Descriptions.Item key={field} label={fieldLabels[field] || field}>
          {renderField(field)}
        </Descriptions.Item>
      ))}
    </Descriptions>
  );

  const tabItems = [
    {
      key: "general",
      label: <span><FileTextOutlined /> Ерөнхий</span>,
      children: (
        <>
          {detailList(visibleFields, "tender-general-details")}
          <div className="tender-field-order-toolbar">
            <Text type="secondary">Талбаруудыг ажлын дарааллаар өөрийнхөөрөө эрэмбэлнэ.</Text>
            <Button size="small" icon={<HolderOutlined />} onClick={openOrderEditor}>
              Дараалал тохируулах
            </Button>
          </div>
        </>
      ),
    },
    {
      key: "finance",
      label: (
        <span>
          <DollarCircleOutlined /> {isEvaluationCommittee ? "Үнэлгээний хороо" : "Нийгэмлэгийн комис"}
        </span>
      ),
      children: (
        <Card styles={{ body: { padding: 0 } }}>
          {detailList(
            isEvaluationCommittee
              ? ["ү_дарга", "ү_гишүүд", "ү_дугаар", "ү_огноо"]
              : NIIGEMLEG_FIELDS
          )}
        </Card>
      ),
    },
    {
      key: "items",
      label: <span><ShoppingCartOutlined /> Захиалга</span>,
      children: (
        <BasketItemsDetails
          key={activeRecord.tender_id}
          basketIds={activeRecord.basket_ids}
          includeReturned={isHistoricalView}
          itemScrollY="min(420px, 45vh)"
        />
      ),
    },
  ];

  const contractDisabledReason = isWaitingExternal
    ? "Дахин зарласан тендер гадаад системийн мэдээлэл хүлээж байна"
    : isHistoricalView
    ? "Түүхэн хувилбар дээр үйлдэл хийх боломжгүй"
    : isSuspended
    ? "Түдгэлзүүлсэн тендерт гэрээ үүсгэх боломжгүй"
    : hasContract
      ? `Энэ тендерт гэрээ аль хэдийн үүссэн${
          contractSpecialistName
            ? ` · Гэрээний мэргэжилтэн: ${contractSpecialistName}`
            : ""
        }`
    : completion < 100
      ? "Тендерийн мэдээллийг 100% бүрдүүлсний дараа гэрээ үүсгэнэ"
      : isManagement
        ? "Удирдлагын эрхээр гэрээ үүсгэх боломжгүй"
        : "";

  return (
    <>
      <Modal
        open={visible}
        onCancel={onClose}
        footer={null}
        destroyOnHidden
        width="min(1440px, 96vw)"
        style={{ top: 20 }}
        className="tender-workspace-modal"
      >
        <div className="tender-modal-header">
          <div className="tender-modal-header__identity">
            <div className="tender-modal-header__icon">
              <FileTextOutlined />
            </div>
            <div>
              <div className="tender-modal-eyebrow">Тендерийн ажлын талбар</div>
              <h2 className="tender-modal-title">{activeRecord.tender_name || "Тендерийн дэлгэрэнгүй"}</h2>
              <div className="tender-modal-meta">
                <Tag color="blue">№ {activeRecord.тендерийн_дугаар || "Дугааргүй"}</Tag>
                <Tag>{tenderType || "Төрөлгүй"}</Tag>
                <Tag color={isWaitingExternal ? "gold" : isHistoricalView ? "default" : "processing"}>
                  v{activeRecord.version_no || 1}.0 {isWaitingExternal ? "· Хүлээгдэж буй" : isHistoricalView ? "· Түүх" : "· Одоо"}
                </Tag>
                <Tag color={isWaitingExternal ? "gold" : isSuspended ? "warning" : "success"}>
                  {isWaitingExternal ? "Дахин зарласан" : isSuspended ? "Түдгэлзүүлсэн" : "Идэвхтэй"}
                </Tag>
                {hasContract && <Tag icon={<CheckCircleOutlined />} color="success">Гэрээ үүссэн</Tag>}
                {showReturnedContract && !hasContract && (
                  <Tag icon={<ReloadOutlined />} color="warning">Гэрээнээс буцаасан</Tag>
                )}
              </div>
            </div>
          </div>
          <div className="tender-modal-header__context">
            <div className="tender-modal-context-item">
              <span><ApartmentOutlined /> Байгууллага</span>
              <strong>{activeRecord.Organization || "Тодорхойгүй"}</strong>
            </div>
            <div className="tender-modal-context-item">
              <span><SafetyCertificateOutlined /> Хариуцсан ажилтан</span>
              <strong>{ownerName}</strong>
            </div>
          </div>
          <div className="tender-modal-progress">
            <div className="tender-modal-progress__label">
              <span>Мэдээллийн бүрдэл</span>
              <strong>{completion}%</strong>
            </div>
            <Progress percent={completion} showInfo={false} strokeColor="#4f8198" trailColor="#dce7eb" />
            <Text type="secondary">Гэрээ үүсгэхэд 100% шаардлагатай</Text>
          </div>
        </div>

        {showReturnedContract && !hasContract && (
          <div className="tender-contract-return-alert">
            <Alert
              type="warning"
              showIcon
              message="Гэрээний мэргэжилтнээс буцаасан"
              description={(
                <div>
                  <strong>{record.returned_contract_comment || "Тайлбар оруулаагүй"}</strong>
                  <span>
                    {record.returned_contract_by || "Тодорхойгүй мэргэжилтэн"}
                    {record.returned_contract_at && dayjs(record.returned_contract_at).isValid()
                      ? ` · ${dayjs(record.returned_contract_at).format("YYYY.MM.DD HH:mm")}`
                      : ""}
                  </span>
                </div>
              )}
            />
          </div>
        )}

        <div className="tender-modal-body">
          <main className="tender-workspace-main">
            <Form form={form} layout="vertical">
              <Tabs type="card" activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
            </Form>
          </main>

          <aside className="tender-version-panel">
            <div className="tender-side-section-title">
              <SafetyCertificateOutlined /> Үйлдэл
            </div>
            <Space direction="vertical" size={8} style={{ width: "100%", marginBottom: 20 }}>
              <Tooltip title={contractDisabledReason} placement="left">
                <span style={{ width: "100%" }}>
                  <Button
                    type="primary"
                    block
                    icon={hasContract ? <CheckCircleOutlined /> : <FileTextOutlined />}
                    disabled={Boolean(contractDisabledReason)}
                    onClick={() => setContractModalOpen(true)}
                  >
                    {hasContract ? "Гэрээ үүссэн" : "Гэрээ үүсгэх"}
                  </Button>
                </span>
              </Tooltip>
              {!isManagement && (
                <Tooltip
                  title={isWaitingExternal
                    ? "Гадаад системийн мэдээлэл ирэхийг хүлээж байна"
                    : isSuspended
                    ? "Түдгэлзүүлсэн тендерийг дахин зарлах боломжгүй"
                    : isHistoricalView
                      ? "Түүхэн хувилбарыг дахин зарлах боломжгүй"
                    : hasContract
                      ? "Гэрээ үүссэн тендерийг дахин зарлах боломжгүй"
                      : ""}
                  placement="left"
                >
                  <span style={{ width: "100%" }}>
                    <Button
                      block
                      icon={<ReloadOutlined />}
                      disabled={hasContract || isSuspended || isHistoricalView || isWaitingExternal}
                      onClick={() => setReannounceModalOpen(true)}
                    >
                      Тендер дахин зарлах
                    </Button>
                  </span>
                </Tooltip>
              )}
              {!isManagement && (
                isSuspended ? (
                  <Button
                    block
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    disabled={isHistoricalView || isWaitingExternal}
                    onClick={() => {
                      Modal.confirm({
                        title: "Тендерийг идэвхтэй болгох уу?",
                        content: "Тендер түдгэлзүүлсэн жагсаалтаас идэвхтэй жагсаалт руу шилжинэ.",
                        okText: "Идэвхтэй болгох",
                        cancelText: "Болих",
                        onOk: () => onActivate(record),
                      });
                    }}
                  >
                    Идэвхтэй болгох
                  </Button>
                ) : (
                  <Button
                    block
                    danger
                    icon={<PauseCircleOutlined />}
                    disabled={isHistoricalView || isWaitingExternal}
                    onClick={() => onSuspend(record)}
                  >
                    Түдгэлзүүлэх
                  </Button>
                )
              )}
              <Tooltip
                title={isWaitingExternal
                  ? "Хүлээгдэж буй тендерийг устгах боломжгүй"
                  : isHistoricalView
                  ? "Түүхэн хувилбарыг устгах боломжгүй"
                  : hasContract
                    ? "Гэрээ үүссэн тендерийг устгах боломжгүй"
                    : ""}
                placement="left"
              >
                <span style={{ width: "100%" }}>
                  <Button
                    block
                    danger
                    icon={<DeleteOutlined />}
                    disabled={hasContract || isHistoricalView || isWaitingExternal}
                    onClick={() => {
                      Modal.confirm({
                        title: "Тендер устгах уу?",
                        content: `“${record.tender_name || record.тендерийн_дугаар || "Тендер"}” дахин харагдахгүй болно.`,
                        okText: "Устгах",
                        okButtonProps: { danger: true },
                        cancelText: "Болих",
                        onOk: () => onDelete(record),
                      });
                    }}
                  >
                    Тендер устгах
                  </Button>
                </span>
              </Tooltip>
            </Space>

            <div className="tender-side-divider" />
            <div className="tender-side-section-title">
              <HistoryOutlined /> Хувилбарын түүх
            </div>
            <div className="tender-version-list">
              {versionsLoading ? (
                <div className="tender-version-loading"><Spin size="small" /> Уншиж байна...</div>
              ) : versionHistory.map((version) => (
                  <button
                    type="button"
                    key={version.tender_id}
                    className={`tender-version-item ${Number(selectedVersionId) === Number(version.tender_id) ? "active" : ""}`}
                    onClick={() => setSelectedVersionId(version.tender_id)}
                  >
                    <FolderOpenOutlined />
                    <span>v{version.version_no || 1}.0</span>
                    {version.is_current && <Tag bordered={false} color="processing">Одоо</Tag>}
                    {version.lifecycle_status === "WaitingExternal" && <Tag bordered={false} color="gold">Хүлээгдэж буй</Tag>}
                  </button>
                ))}
            </div>
          </aside>
        </div>
      </Modal>

      <Modal
        open={orderEditorOpen}
        title="Талбарын дараалал тохируулах"
        width={620}
        okText="Дараалал хадгалах"
        cancelText="Болих"
        onOk={saveFieldOrder}
        onCancel={() => setOrderEditorOpen(false)}
        destroyOnHidden
      >
        <div className="tender-field-order-editor__intro">
          <Text type="secondary">Чирж зөөх эсвэл сум ашиглан дарааллыг өөрчилнө үү.</Text>
          <Button
            size="small"
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => setDraftFieldOrder([...generalFieldOrder])}
          >
            Үндсэн дараалал
          </Button>
        </div>
        <div className="tender-field-order-list">
          {draftFieldOrder.map((field, index) => (
            <div
              key={field}
              draggable
              className={`tender-field-order-item ${draggedField === field ? "dragging" : ""}`}
              onDragStart={() => setDraggedField(field)}
              onDragEnd={() => setDraggedField(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropDraftField(field)}
            >
              <HolderOutlined className="tender-field-order-item__handle" />
              <span className="tender-field-order-item__number">{index + 1}</span>
              <span className="tender-field-order-item__label">{fieldLabels[field] || field}</span>
              <Space size={4}>
                <Button
                  size="small"
                  type="text"
                  aria-label="Дээш зөөх"
                  icon={<ArrowUpOutlined />}
                  disabled={index === 0}
                  onClick={() => moveDraftField(field, -1)}
                />
                <Button
                  size="small"
                  type="text"
                  aria-label="Доош зөөх"
                  icon={<ArrowDownOutlined />}
                  disabled={index === draftFieldOrder.length - 1}
                  onClick={() => moveDraftField(field, 1)}
                />
              </Space>
            </div>
          ))}
        </div>
      </Modal>

      <ContractCreateModal
        open={contractModalOpen}
        tender={record}
        onCancel={() => setContractModalOpen(false)}
        onCreated={(tenderId) => {
          setContractModalOpen(false);
          onContractCreated(tenderId);
        }}
      />
      <TenderReannounceModal
        open={reannounceModalOpen}
        record={record}
        onClose={() => setReannounceModalOpen(false)}
        onArchived={(result) => {
          setReannounceModalOpen(false);
          onReannounced?.(record?.tender_id, result);
        }}
      />
    </>
  );
};

TenderModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  record: PropTypes.object,
  user: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  handleUpdate: PropTypes.func.isRequired,
  onSuspend: PropTypes.func.isRequired,
  onActivate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  hasContract: PropTypes.bool,
  existingContract: PropTypes.object,
  onContractCreated: PropTypes.func.isRequired,
  onReannounced: PropTypes.func,
};

export default TenderModal;
