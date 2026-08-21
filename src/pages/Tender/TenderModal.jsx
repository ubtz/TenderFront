import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  Progress,
  Select,
  Space,
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
import dayjs from "dayjs";
import BasketItemsDetails from "../Бүртгэл/BasketItemsDetails";
import ContractCreateModal from "./ContractCreateModal";
import { fieldLabels, generalFieldOrder } from "./tender.fields";
import { calcCompletion, isEmpty } from "./tender.utils";

const { Text } = Typography;

const EXCLUDED_FIELDS = [
  "tender_id", "created_at", "created_by", "тендер_амжилттай_болсон_эсэх",
  "plan_root_number", "tender_name", "тендерийн_дугаар", "тендерт_оролцогч",
  "урилгийн_дугаар", "урилгийн_огноо", "гомдол_гаргасан_огноо",
  "түтгэлзүүлсэн_огноо", "ү_дарга", "ү_гишүүд", "ү_дугаар", "ү_огноо",
  "зүк_дугаар", "зүк_огноо", "basket_ids", "Ovog", "Ner", "root_tender_id",
];

const NIIGEMLEG_FIELDS = ["ү_дугаар", "ү_огноо"];
const LIMITED_FIELDS = [
  "шалгаруулалтын_төрөл",
  "тендерийн_төрөл",
  "батлагдсан_төсөвт_өртөг",
  "гэрээ_байгуулах_эрх_олгосон_огноо",
  "тайлбар",
];

const versions = [
  { id: "v1", label: "v1.0" },
  { id: "v2", label: "v2.0" },
  { id: "Одоо", label: "Одоо" },
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
  onContractCreated,
}) => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("general");
  const [activeVersion, setActiveVersion] = useState("v2");
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [orderEditorOpen, setOrderEditorOpen] = useState(false);
  const [fieldOrder, setFieldOrder] = useState(() => [...generalFieldOrder]);
  const [draftFieldOrder, setDraftFieldOrder] = useState(() => [...generalFieldOrder]);
  const [draggedField, setDraggedField] = useState(null);

  const fieldOrderStorageKey = useMemo(() => {
    const userIdentity = user?.id || user?.Id || user?.username || user?.Username || "default";
    return `tender-general-field-order:${userIdentity}`;
  }, [user]);

  const isManagement = user?.erh === "Удирдлага" || user?.Erh === "Удирдлага";
  const tenderType = record?.тендерийн_төрөл?.trim();
  const ownerName = `${record?.Ovog || ""} ${record?.Ner || ""}`.trim() || "Хариуцагчгүй";
  const isEvaluationCommittee = ["НТШ", "ХА"].includes(tenderType);
  const completionMode = isEvaluationCommittee ? "default" : "zuk";
  const isSuspended = !String(record?.түтгэлзүүлсэн_огноо || "").startsWith("1900");
  const completion = useMemo(
    () => calcCompletion(record, completionMode),
    [completionMode, record]
  );

  useEffect(() => {
    if (!record) return;
    form.setFieldsValue(normalizeRecordForForm(record));
    setActiveTab("general");
  }, [form, record]);

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
    if (!record) return [];
    const fields = isEvaluationCommittee
      ? Object.keys(record).filter((field) => !EXCLUDED_FIELDS.includes(field))
      : LIMITED_FIELDS;
    const order = new Map(fieldOrder.map((field, index) => [field, index]));
    return [...fields].sort((first, second) =>
      (order.get(first) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(second) ?? Number.MAX_SAFE_INTEGER)
    );
  }, [fieldOrder, isEvaluationCommittee, record]);

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
    const current = serializeValue(record?.[field]);
    if (String(serialized) === String(current)) return;
    handleUpdate(record.tender_id, field, serialized);
  };

  const renderReadOnly = (field) => {
    const value = record?.[field];
    if (isEmpty(value)) return <Text type="secondary">—</Text>;
    if (field.includes("огноо")) {
      const date = dayjs(value);
      return date.isValid() ? date.format("YYYY-MM-DD") : value;
    }
    if (field === "батлагдсан_төсөвт_өртөг") {
      return `${Number(value).toLocaleString()} ₮`;
    }
    return String(value);
  };

  const renderField = (field) => {
    if (isManagement) return renderReadOnly(field);

    if (field === "тендерийн_төрөл") {
      return (
        <Form.Item name={field} noStyle>
          <Select
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

  if (!record) return null;

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
      children: <BasketItemsDetails basketIds={record.basket_ids} versionId={activeVersion} />,
    },
  ];

  const contractDisabledReason = hasContract
    ? "Энэ тендерт гэрээ аль хэдийн үүссэн"
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
              <h2 className="tender-modal-title">{record.tender_name || "Тендерийн дэлгэрэнгүй"}</h2>
              <div className="tender-modal-meta">
                <Tag color="blue">№ {record.тендерийн_дугаар || "Дугааргүй"}</Tag>
                <Tag>{tenderType || "Төрөлгүй"}</Tag>
                <Tag color={isSuspended ? "warning" : "success"}>
                  {isSuspended ? "Түдгэлзүүлсэн" : "Идэвхтэй"}
                </Tag>
                {hasContract && <Tag icon={<CheckCircleOutlined />} color="success">Гэрээ үүссэн</Tag>}
              </div>
            </div>
          </div>
          <div className="tender-modal-header__context">
            <div className="tender-modal-context-item">
              <span><ApartmentOutlined /> Байгууллага</span>
              <strong>{record.Organization || "Тодорхойгүй"}</strong>
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
                isSuspended ? (
                  <Button
                    block
                    type="primary"
                    icon={<CheckCircleOutlined />}
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
                    onClick={() => onSuspend(record)}
                  >
                    Түдгэлзүүлэх
                  </Button>
                )
              )}
              <Tooltip
                title={hasContract ? "Гэрээ үүссэн тендерийг устгах боломжгүй" : ""}
                placement="left"
              >
                <span style={{ width: "100%" }}>
                  <Button
                    block
                    danger
                    icon={<DeleteOutlined />}
                    disabled={hasContract}
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
              {versions.map((version) => (
                <div
                  key={version.id}
                  className={`tender-version-item ${activeVersion === version.id ? "active" : ""}`}
                  onClick={() => setActiveVersion(version.id)}
                >
                  <FolderOpenOutlined />
                  {version.label}
                </div>
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
    </>
  );
};

export default TenderModal;
