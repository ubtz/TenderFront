import React, { useState, useEffect } from "react";
import {
  Modal,
  Row,
  Col,
  Card,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Collapse,
  Tag,
  Button,
  Segmented,
  Typography,
  message,
  Spin,
  Space,
} from "antd";
import {
  FileTextOutlined,
  DollarCircleOutlined,
  FileDoneOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import BasketItemsDetails from "./BasketItemsDetails";
import dayjs from "dayjs";
import axios from "axios";

const { TextArea } = Input;
const { Title } = Typography;

const GereeModal = ({ visible, record, onClose, user, handleUpdate }) => {
  const [viewMode, setViewMode] = useState("details");
  const [loadingReg, setLoadingReg] = useState(false);
  const [apiToken, setApiToken] = useState(null);


  const [localRecord, setLocalRecord] = useState(record);

  useEffect(() => {
    setLocalRecord(record);
  }, [record]);
  if (!record) return null;

  /** === API: Get token === */
  const getNewToken = async () => {
    try {
      const res = await axios.post("http://192.168.4.107:8008/v1/token/gtoken", {
        Username: "coss.api.lib.nrp",
        Password: "coss.api.lib.nrp.",
      });
      if (res.data?.tokendata) {
        setApiToken(res.data.tokendata);
        return res.data.tokendata;
      }
    } catch (err) {
      console.error("⚠️ Token fetch failed:", err);
      message.error("Token татахад алдаа гарлаа");
    }
    return null;
  };

  /** === Fetch client info by register === */
  const fetchClientInfo = async (reg) => {
    if (!reg) return;
    try {
      setLoadingReg(true);
      let token = apiToken || (await getNewToken());
      if (!token) return;

      const API_URL = "http://192.168.4.107:8008/v1/orders/client";
      let res = await axios.post(API_URL, { Value: reg, Token: token });

      if (res.data?.status === false || /token/i.test(res.data?.message || "")) {
        token = await getNewToken();
        if (!token) return;
        res = await axios.post(API_URL, { Value: reg, Token: token });
      }

      if (res.data?.status) {
        const companyName =
          res.data.message && res.data.message !== "Not found!"
            ? res.data.message
            : "Бүртгэлгүй ААН";
        handleChange("ААН_регистер", reg.trim());
        handleChange("бэлтгэн_нийлүүлэгч_ААН", companyName);
        message.success(`✅ ${companyName}`);
      } else {
        message.warning("⚠️ ААН олдсонгүй.");
      }
    } catch (err) {
      console.error("❌ Client info fetch failed:", err);
      message.error("ААН мэдээлэл татахад алдаа гарлаа");
    } finally {
      setLoadingReg(false);
    }
  };

  const handleChange = async (field, value) => {
    setLocalRecord((prev) => ({ ...prev, [field]: value })); // instant update
    try {
      await handleUpdate(record.GereeId, field, value);
    } catch {
      message.error("Өөрчлөлт хадгалахад алдаа гарлаа");
    }
  };


  const Label = ({ text }) => (
    <div
      style={{
        fontSize: 13,
        fontWeight: 500,
        color: "#475569",
        marginBottom: 4,
      }}
    >
      {text}
    </div>
  );

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden
      width={1150}
      style={{
        borderRadius: 24,
        overflow: "hidden",
        boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
      }}
      styles={{
        body: {
          padding: 0,
          background: "linear-gradient(145deg, #f9fafc, #eef2f7)",
        },
      }}
    >
      {/* HEADER */}
      <div
        style={{
          padding: "20px 32px",
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: "#0f172a" }}>
            <FileTextOutlined style={{ color: "#3b82f6", marginRight: 8 }} />
            Гэрээ № {record["гэрээний_дугаар"] || "..."}
          </h2>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {record["бэлтгэн_нийлүүлэгч_ААН"] || "Бэлтгэн нийлүүлэгч тодорхойгүй"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Segmented
            size="middle"
            value={viewMode}
            onChange={setViewMode}
            options={[
              {
                label: (
                  <span>
                    <FileTextOutlined /> Дэлгэрэнгүй
                  </span>
                ),
                value: "details",
              },
              {
                label: (
                  <span>
                    <ShoppingCartOutlined /> Холбогдох захиалгууд
                  </span>
                ),
                value: "orders",
              },
            ]}
          />
          <Button danger onClick={onClose}>
            Хаах
          </Button>
        </div>
      </div>

      {/* BODY */}
      {viewMode === "details" ? (
        <Row gutter={20} style={{ padding: 24 }}>
          {/* LEFT SIDE */}
          <Col span={8}>
            <Card
              title="Үндсэн мэдээлэл"
              variant="borderless"
              style={{
                borderRadius: 16,
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              }}
            >
              <Label text="ААН регистер" />
              <Space.Compact style={{ width: "100%", marginBottom: 12 }}>
                <Input
                  placeholder="Регистрийн дугаар"
                  allowClear
                  onPressEnter={(e) => fetchClientInfo(e.target.value)}
                />
                <Button
                  type="primary"
                  onClick={() => fetchClientInfo(regValue)}
                >
                  Хайх
                </Button>
              </Space.Compact>


              <Label text="Бэлтгэн нийлүүлэгч ААН" />
              <Input
                value={localRecord?.["бэлтгэн_нийлүүлэгч_ААН"] || ""}
              />

              <Label text="Худалдан авагч" />
              <Input
                defaultValue={record["гэрээ_байгуулсан_ААН"]}
                onBlur={(e) =>
                  handleChange("гэрээ_байгуулсан_ААН", e.target.value)
                }
                style={{ marginBottom: 12 }}
              />

              <Label text="Гэрээ байгуулсан огноо" />
              <DatePicker
                style={{ width: "100%", marginBottom: 12 }}
                value={
                  record["гэрээ_байгуулсан_огноо"]
                    ? dayjs(record["гэрээ_байгуулсан_огноо"])
                    : null
                }
                onChange={(d) =>
                  handleChange(
                    "гэрээ_байгуулсан_огноо",
                    d ? d.format("YYYY-MM-DD") : ""
                  )
                }
              />

              <Label text="Гэрээний дүн" />
              <InputNumber
                style={{ width: "100%" }}
                defaultValue={record["гэрээний_дүн"]}
                onBlur={(e) =>
                  handleChange("гэрээний_дүн", e.target.value || e.target.valueAsNumber)
                }
              />

              <Tag
                color={record["гэрээний_төлөв"] ? "green" : "blue"}
                style={{ marginTop: 16 }}
              >
                {record["гэрээний_төлөв"] || "Идэвхтэй"}
              </Tag>
            </Card>
          </Col>

          {/* RIGHT SIDE */}
          <Col span={16}>
            <Collapse
              defaultActiveKey={["1"]}
              bordered={false}
              items={[
                {
                  key: "1",
                  label: (
                    <span>
                      <DollarCircleOutlined /> Төлбөр ба нийлүүлэлт
                    </span>
                  ),
                  children: (
                    <Row gutter={[16, 12]}>
                      <Col span={12}>
                        <Label text="Төлбөрийн нөхцөл" />
                        <Input
                          defaultValue={record["төлбөрийн_нөхцөл"]}
                          onBlur={(e) =>
                            handleChange("төлбөрийн_нөхцөл", e.target.value)
                          }
                        />
                      </Col>
                      <Col span={12}>
                        <Label text="Төлбөрийн огноо" />
                        <DatePicker
                          style={{ width: "100%" }}
                          value={
                            record["төлбөрийн_огноо"]
                              ? dayjs(record["төлбөрийн_огноо"])
                              : null
                          }
                          onChange={(d) =>
                            handleChange(
                              "төлбөрийн_огноо",
                              d ? d.format("YYYY-MM-DD") : ""
                            )
                          }
                        />
                      </Col>
                      <Col span={12}>
                        <Label text="Нийлүүлэх нөхцөл" />
                        <Input
                          defaultValue={record["нийлүүлэх_нөхцөл"]}
                          onBlur={(e) =>
                            handleChange("нийлүүлэх_нөхцөл", e.target.value)
                          }
                        />
                      </Col>
                      <Col span={12}>
                        <Label text="Нийлүүлэх хугацаа" />
                        <Input
                          defaultValue={record["нийлүүлэх_хугацаа"]}
                          onBlur={(e) =>
                            handleChange("нийлүүлэх_хугацаа", e.target.value)
                          }
                        />
                      </Col>
                    </Row>
                  ),
                },
                {
                  key: "2",
                  label: (
                    <span>
                      <FileDoneOutlined /> Дүгнэлт ба нэмэлт
                    </span>
                  ),
                  children: (
                    <Row gutter={[16, 12]}>
                      <Col span={24}>
                        <Label text="Санамж / Дүгнэлт" />
                        <TextArea
                          rows={3}
                          defaultValue={record["санамж"]}
                          onBlur={(e) => handleChange("санамж", e.target.value)}
                        />
                      </Col>
                    </Row>
                  ),
                },
              ]}
            />
          </Col>
        </Row>
      ) : (
        <div
          style={{
            padding: 24,
            background: "#f9fafb",
            height: "70vh",
            overflowY: "auto",
          }}
        >
          <Title level={4} style={{ marginBottom: 20 }}>
            <ShoppingCartOutlined /> Холбогдох захиалгууд
          </Title>
          <BasketItemsDetails basketIds={record.basket_ids} mode="geree" />
        </div>
      )}
    </Modal>
  );
};

export default GereeModal;
