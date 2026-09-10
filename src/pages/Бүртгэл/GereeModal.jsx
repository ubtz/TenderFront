import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Col,
  Collapse,
  DatePicker,
  Descriptions,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  DollarCircleOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  RollbackOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import PropTypes from "prop-types";
import BasketItemsDetails from "./BasketItemsDetails";
import { calcCompletion } from "./GereeFieldRenderers";
import { useContractDraft } from "./useContractDraft";

const { TextArea } = Input;
const { Text } = Typography;
const API_BASE_URL = import.meta.env.VITE_API_URL;
const formatDateTime = (value) => dayjs(value).isValid() ? dayjs(value).format("YYYY.MM.DD HH:mm") : "—";
const FieldLabel = ({ children }) => <div className="geree-field-label">{children}</div>;

FieldLabel.propTypes = {
  children: PropTypes.node.isRequired,
};

const GereeModal = ({ visible, record, onClose, handleUpdate, canReturn, onReturned }) => {
  const [viewMode, setViewMode] = useState("details");
  const [loadingReg, setLoadingReg] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [returning, setReturning] = useState(false);
  const { draft: localRecord, setDraft, saveField } = useContractDraft(record, visible, handleUpdate);
  const regValue = String(localRecord?.["ААН_регистер"] || "");
  const [arrivalPercent, setArrivalPercent] = useState(null);

  useEffect(() => {
    setViewMode("details");
    setReturnModalOpen(false);
    setReturnComment("");
  }, [record?.GereeId, visible]);

  useEffect(() => {
    if (!visible || !record?.basket_ids) {
      setArrivalPercent(null);
      return;
    }

    let cancelled = false;
    const basketIds = Array.isArray(record.basket_ids)
      ? record.basket_ids.join(",")
      : record.basket_ids;

    axios.get(`${API_BASE_URL}/get/GetBasketItemsById/${basketIds}`)
      .then((response) => {
        if (cancelled) return;
        const arrivalItems = Array.isArray(response.data) ? response.data : [];
        const orderedQuantity = arrivalItems.reduce(
          (sum, item) => sum + Math.max(0, Number(item.qty) || 0),
          0
        );
        const arrivedQuantity = arrivalItems.reduce((sum, item) => {
          let arrivals = [];
          try {
            const parsed = JSON.parse(item.tailbar || "[]");
            arrivals = Array.isArray(parsed) ? parsed : [];
          } catch {
            arrivals = [];
          }
          const itemArrived = arrivals.reduce(
            (total, arrival) => total + Math.max(0, Number(arrival.qty) || 0),
            0
          );
          return sum + Math.min(Math.max(0, Number(item.qty) || 0), itemArrived);
        }, 0);
        setArrivalPercent(orderedQuantity > 0
          ? Math.min(100, Math.round((arrivedQuantity / orderedQuantity) * 100))
          : 0);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Contract arrival progress fetch failed:", error);
          setArrivalPercent(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [record?.basket_ids, visible]);

  if (!record || !localRecord) return null;

  const fetchClientInfo = async () => {
    const register = regValue.trim();
    if (!register) return;
    try {
      setLoadingReg(true);
      const response = await axios.post(`${API_BASE_URL}/external/orders/client`, { Value: register });
      if (!response.data?.status) {
        message.warning("ААН олдсонгүй");
        return;
      }
      const companyName = response.data.message && response.data.message !== "Not found!"
        ? response.data.message
        : "Бүртгэлгүй ААН";
      if (!await saveField("ААН_регистер", register)) return;
      if (!await saveField("бэлтгэн_нийлүүлэгч_ААН", companyName)) return;
      message.success(`${companyName} олдлоо`);
    } catch (error) {
      console.error("Client info fetch failed:", error);
      message.error("ААН мэдээлэл татахад алдаа гарлаа");
    } finally {
      setLoadingReg(false);
    }
  };

  const completion = calcCompletion(localRecord, arrivalPercent);
  const contractName = localRecord["гэрээний_дугаар"] || "Нэр өгөөгүй гэрээ";
  const creatorName = localRecord.created_by_user || localRecord.geree_user_name || "Тодорхойгүй";
  const currentCurrency = String(localRecord["валют"] || "MNT").trim();
  const currencyOptions = [...new Set([currentCurrency, "MNT", "USD", "EUR", "CNY", "RUB"])]
    .filter(Boolean)
    .map((currency) => ({ label: currency, value: currency }));

  const returnContract = async () => {
    const comment = returnComment.trim();
    if (!comment) {
      message.warning("Буцаах тайлбар оруулна уу");
      return;
    }
    try {
      setReturning(true);
      const response = await axios.put(
        `${API_BASE_URL}/put/ReturnGeree/${localRecord.GereeId}`,
        { comment }
      );
      message.success(response.data?.message || "Гэрээг тендерийн мэргэжилтэнд буцаалаа");
      setReturnModalOpen(false);
      setReturnComment("");
      onReturned(localRecord.GereeId, localRecord.TenderId);
    } catch (error) {
      console.error("Contract return failed:", error);
      message.error(error.response?.data?.error || "Гэрээг буцаахад алдаа гарлаа");
    } finally {
      setReturning(false);
    }
  };

  return (
    <>
      <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden
      width={1240}
      className="geree-workspace-modal"
    >
      <header className="geree-modal-header">
        <div className="geree-modal-header__identity">
          <span className="geree-modal-header__icon"><FileDoneOutlined /></span>
          <div className="geree-modal-header__copy">
            <div className="geree-modal-eyebrow">Гэрээний ажлын талбар</div>
            <h2>{contractName}</h2>
            <div className="geree-modal-meta">
              <Tag color="processing">{localRecord["валют"] || "MNT"}</Tag>
              <Tag color={localRecord["гэрээний_төлөв"] === "Дууссан" ? "default" : "success"}>
                {localRecord["гэрээний_төлөв"] || "Идэвхтэй"}
              </Tag>
            </div>
          </div>
        </div>

        <div className="geree-modal-header__context">
          <div>
            <span>Эх тендер</span>
            <strong>{localRecord["тендерийн_дугаар"] || "—"}</strong>
          </div>
          <div>
            <span>Үүсгэсэн ажилтан</span>
            <strong title={creatorName}>{creatorName}</strong>
          </div>
          <div>
            <span>Үүсгэсэн огноо</span>
            <strong>{formatDateTime(localRecord.CreatedAt)}</strong>
          </div>
        </div>

        <div className="geree-modal-progress">
          <div><span>Мэдээллийн бүрдэл</span><strong>{completion}%</strong></div>
          <Progress percent={completion} showInfo={false} strokeColor="#4f7f9d" />
          <Text type="secondary">
            Гэрээний талбар · Ирсэн {arrivalPercent === null ? "—" : arrivalPercent + "%"}
          </Text>
        </div>
      </header>

      <div className="geree-modal-switcher">
        <Segmented
          value={viewMode}
          onChange={setViewMode}
          options={[
            { label: <span><FileTextOutlined /> Үндсэн мэдээлэл</span>, value: "details" },
            { label: <span><ShoppingCartOutlined /> Холбогдох захиалгууд</span>, value: "orders" },
          ]}
        />
        {canReturn && (
          <Button
            danger
            icon={<RollbackOutlined />}
            onClick={() => setReturnModalOpen(true)}
          >
            Тендерийн мэргэжилтэнд буцаах
          </Button>
        )}
      </div>

      {viewMode === "details" ? (
        <div className="geree-modal-body">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={9}>
              <Card title={<span><FileTextOutlined /> Үндсэн мэдээлэл</span>} className="geree-info-card">
                <div className="geree-source-tender">
                  <div className="geree-section-kicker">Эх тендер</div>
                  <Descriptions
                    size="small"
                    column={1}
                    items={[
                      { key: "number", label: "Дугаар", children: localRecord["тендерийн_дугаар"] || "—" },
                      { key: "type", label: "Төрөл", children: localRecord["тендерийн_төрөл"] || "—" },
                    ]}
                  />
                </div>

                <FieldLabel>Гэрээний нэр</FieldLabel>
                <Input
                  value={localRecord["гэрээний_дугаар"] || ""}
                  placeholder="Гэрээний нэр оруулах"
                  maxLength={150}
                  onChange={(event) => setDraft("гэрээний_дугаар", event.target.value)}
                  onBlur={(event) => saveField("гэрээний_дугаар", event.target.value.trim())}
                />

                <FieldLabel>ААН регистер</FieldLabel>
                <Space.Compact className="geree-register-search">
                  <Input
                    placeholder="Регистрийн дугаар"
                    allowClear
                    value={regValue}
                    onChange={(event) => {
                      setDraft("ААН_регистер", event.target.value);
                    }}
                    onBlur={(event) => {
                      const register = event.target.value.trim();
                      if (register !== String(record["ААН_регистер"] || "").trim()) {
                        saveField("ААН_регистер", register);
                      }
                    }}
                    onPressEnter={fetchClientInfo}
                  />
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    loading={loadingReg}
                    disabled={!regValue.trim()}
                    onClick={fetchClientInfo}
                  >
                    Хайх
                  </Button>
                </Space.Compact>

                <FieldLabel>Бэлтгэн нийлүүлэгч ААН</FieldLabel>
                <Input value={localRecord["бэлтгэн_нийлүүлэгч_ААН"] || ""} readOnly />

                <FieldLabel>Худалдан авагч</FieldLabel>
                <Input
                  value={localRecord["гэрээ_байгуулсан_ААН"] || ""}
                  onChange={(event) => setDraft("гэрээ_байгуулсан_ААН", event.target.value)}
                  onBlur={(event) => saveField("гэрээ_байгуулсан_ААН", event.target.value)}
                />

                <div className="geree-field-grid">
                  <div>
                    <FieldLabel>Гэрээ байгуулсан огноо</FieldLabel>
                    <DatePicker
                      value={localRecord["гэрээ_байгуулсан_огноо"] ? dayjs(localRecord["гэрээ_байгуулсан_огноо"]) : null}
                      onChange={(date) => saveField("гэрээ_байгуулсан_огноо", date ? date.format("YYYY-MM-DD") : "")}
                    />
                  </div>
                  <div>
                    <FieldLabel>Гэрээний дүн</FieldLabel>
                    <InputNumber
                      value={localRecord["гэрээний_дүн"] || null}
                      min={0}
                      controls={false}
                      formatter={(value) => String(value ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                      parser={(value) => value?.replace(/,/g, "")}
                      onChange={(value) => setDraft("гэрээний_дүн", value)}
                      onBlur={() => saveField("гэрээний_дүн", localRecord["гэрээний_дүн"] || 0)}
                    />
                  </div>
                  <div>
                    <FieldLabel>Валют</FieldLabel>
                    <Select
                      value={currentCurrency}
                      options={currencyOptions}
                      onChange={(value) => saveField("валют", value)}
                    />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={15}>
              <Card title={<span><DollarCircleOutlined /> Гэрээний хэрэгжилт</span>} className="geree-info-card geree-execution-card">
                <Collapse
                  defaultActiveKey={["delivery", "notes"]}
                  items={[
                    {
                      key: "delivery",
                      label: <span><DollarCircleOutlined /> Төлбөр ба нийлүүлэлт</span>,
                      children: (
                        <Row gutter={[14, 14]}>
                          <Col xs={24} md={12}>
                            <FieldLabel>Төлбөрийн нөхцөл</FieldLabel>
                            <Input
                              value={localRecord["төлбөрийн_нөхцөл"] || ""}
                              onChange={(event) => setDraft("төлбөрийн_нөхцөл", event.target.value)}
                              onBlur={(event) => saveField("төлбөрийн_нөхцөл", event.target.value)}
                            />
                          </Col>
                          <Col xs={24} md={12}>
                            <FieldLabel>Төлбөрийн огноо</FieldLabel>
                            <DatePicker
                              value={localRecord["төлбөрийн_огноо"] ? dayjs(localRecord["төлбөрийн_огноо"]) : null}
                              onChange={(date) => saveField("төлбөрийн_огноо", date ? date.format("YYYY-MM-DD") : "")}
                            />
                          </Col>
                          <Col xs={24} md={12}>
                            <FieldLabel>Нийлүүлэх нөхцөл</FieldLabel>
                            <Input
                              value={localRecord["нийлүүлэх_нөхцөл"] || ""}
                              onChange={(event) => setDraft("нийлүүлэх_нөхцөл", event.target.value)}
                              onBlur={(event) => saveField("нийлүүлэх_нөхцөл", event.target.value)}
                            />
                          </Col>
                          <Col xs={24} md={12}>
                            <FieldLabel>Нийлүүлэх хугацаа (хоног)</FieldLabel>
                            <Input
                              value={localRecord["нийлүүлэх_хугацаа"] || ""}
                              onChange={(event) => setDraft("нийлүүлэх_хугацаа", event.target.value)}
                              onBlur={(event) => saveField("нийлүүлэх_хугацаа", event.target.value)}
                            />
                          </Col>
                        </Row>
                      ),
                    },
                    {
                      key: "notes",
                      label: <span><FileDoneOutlined /> Дүгнэлт ба нэмэлт</span>,
                      children: (
                        <div>
                          <FieldLabel>Санамж / Дүгнэлт</FieldLabel>
                          <TextArea
                            rows={5}
                            value={localRecord["санамж"] || ""}
                            onChange={(event) => setDraft("санамж", event.target.value)}
                            onBlur={(event) => saveField("санамж", event.target.value)}
                            placeholder="Гэрээний хэрэгжилттэй холбоотой тэмдэглэл оруулах"
                          />
                        </div>
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        </div>
      ) : (
        <div className="geree-orders-workspace">
          <div className="geree-orders-workspace__header">
            <div>
              <Text strong>Холбогдох захиалгууд</Text>
              <Text type="secondary">Гэрээнд хамаарах багц болон бараа материал</Text>
            </div>
            <Tag color="blue">{contractName}</Tag>
          </div>
          <BasketItemsDetails
            basketIds={localRecord.basket_ids}
            mode="geree"
            onArrivalProgressChange={setArrivalPercent}
          />
        </div>
      )}
      </Modal>

      <Modal
        open={returnModalOpen}
        title="Гэрээг тендерийн мэргэжилтэнд буцаах"
        okText="Буцаах"
        cancelText="Болих"
        okButtonProps={{ danger: true, disabled: !returnComment.trim() }}
        confirmLoading={returning}
        onOk={returnContract}
        onCancel={() => {
          if (returning) return;
          setReturnModalOpen(false);
          setReturnComment("");
        }}
        destroyOnHidden
        width={600}
        className="geree-return-modal"
      >
        <div className="geree-return-warning">
          Энэ гэрээ идэвхтэй жагсаалтаас хасагдаж, эх тендерийг мэргэжилтэн дахин засварлах боломжтой болно.
        </div>
        <FieldLabel>Буцаах шалтгаан</FieldLabel>
        <TextArea
          autoFocus
          rows={5}
          value={returnComment}
          maxLength={1000}
          showCount
          placeholder="Тендерийн мэргэжилтэн засах шаардлагатай мэдээллийг тодорхой бичнэ үү"
          onChange={(event) => setReturnComment(event.target.value)}
        />
      </Modal>
    </>
  );
};

GereeModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  record: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  handleUpdate: PropTypes.func.isRequired,
  canReturn: PropTypes.bool.isRequired,
  onReturned: PropTypes.func.isRequired,
};

export default GereeModal;
