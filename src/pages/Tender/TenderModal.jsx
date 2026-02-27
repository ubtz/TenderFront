// src/pages/Tender/TenderModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    Modal,
    Form,
    Input,
    Select,
    DatePicker,
    Button,
    Card,
    Descriptions,
    Tabs,
    Tooltip,
} from "antd";
import {
    FileTextOutlined,
    ShoppingCartOutlined,
    DollarCircleOutlined,
    FolderOpenOutlined,
    InfoCircleOutlined,
    ExclamationCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import BasketItemsDetails from "../Бүртгэл/BasketItemsDetails";
import { fieldLabels } from "./tender.fields";

/* ---------------- constants ---------------- */

const EXCLUDED_FIELDS = [
    "tender_id",
    "created_at",
    "created_by",
    "тендер_амжилттай_болсон_эсэх",
    "plan_root_number",
    "tender_name",
    "тендерийн_дугаар",
    "тендерт_оролцогч",
    "түтгэлзүүлсэн_огноо",
    "ү_дарга",
    "ү_гишүүд",
    "ү_дугаар",
    "ү_огноо",
    "зүк_дугаар",
    "зүк_огноо",
    "basket_ids",
    "Ovog",
    "Ner",
    "root_tender_id",
];

const NIIGEMLEG_FIELDS = ["ү_дугаар", "ү_огноо"];

const LIMITED_FIELDS = [
    "шалгаруулалтын_төрөл",
    "тендерийн_төрөл",
    "батлагдсан_төсөвт_өртөг",
    "гэрээ_байгуулах_эрх_олгосон_огноо",
    "тайлбар",
];

/* ---------------- helpers ---------------- */

const normalizeRecordForForm = (record) => {
    if (!record) return record;
    const copy = { ...record };
    Object.keys(copy).forEach((key) => {
        if (key.includes("огноо") && copy[key]) {
            copy[key] = dayjs(copy[key]);
        }
    });
    return copy;
};

const serializeValue = (value) => {
    if (dayjs.isDayjs(value)) {
        return value.format("YYYY-MM-DD");
    }
    return value ?? "";
};

/* ---------------- component ---------------- */

const TenderModal = ({
    visible,
    record,
    user,
    onClose,
    handleUpdate,
    modalTop = "10%",
}) => {
    const [form] = Form.useForm();
    const [activeTab, setActiveTab] = useState("general");
    const [activeVersion, setActiveVersion] = useState("v2");

    const versions = [
        { id: "v1", label: "v1.0" },
        { id: "v2", label: "v2.0" },
        { id: "Одоо", label: "Одоо" },
    ];

    const isUdir =
        user?.erh === "Удирдлага" || user?.Erh === "Удирдлага";

    const tenderType = record?.тендерийн_төрөл;
    const isEvaluationCommittee = ["НТШ", "ХА"].includes(tenderType);

    useEffect(() => {
        if (!record) return;
        form.setFieldsValue(normalizeRecordForForm(record));
    }, [record, form]);

    const visibleFields = useMemo(() => {
        if (!record) return [];
        if (isEvaluationCommittee) {
            return Object.keys(record).filter(
                (f) => !EXCLUDED_FIELDS.includes(f)
            );
        }
        return LIMITED_FIELDS;
    }, [record, isEvaluationCommittee]);

    const saveField = (field, value) => {
        handleUpdate(
            record.tender_id,
            field,
            serializeValue(value)
        );
    };

    const renderField = (field) => {
        if (isUdir) {
            const v = record?.[field];
            if (field.includes("огноо")) {
                return v ? dayjs(v).format("YYYY-MM-DD") : "";
            }
            return v || "";
        }

        if (field === "тендерийн_төрөл") {
            return (
                <Form.Item name={field} noStyle>
                    <Select
                        onChange={(val) => saveField(field, val)}
                        options={[
                            { label: "НТШ", value: "НТШ" },
                            { label: "ХА", value: "ХА" },
                            { label: "Нэг эх үүсвэр", value: "Нэг эх үүсвэр" },
                            { label: "Гэрээ шууд байгуулах", value: "Гэрээ шууд байгуулах" },
                        ]}
                    />
                </Form.Item>
            );
        }

        if (field === "шалгаруулалтын_төрөл") {
            return (
                <Form.Item name={field} noStyle>
                    <Select
                        onChange={(val) => saveField(field, val)}
                        options={[
                            { label: "Бараа", value: "Бараа" },
                            { label: "Ажил үйлчилгээ", value: "Ажил үйлчилгээ" },
                            { label: "Зөвлөх үйлчилгээ", value: "Зөвлөх үйлчилгээ" },
                        ]}
                    />
                </Form.Item>
            );
        }

        if (field.includes("огноо")) {
            return (
                <Form.Item name={field} noStyle>
                    <DatePicker
                        style={{ width: "100%" }}
                        onChange={(v) => saveField(field, v)}
                    />
                </Form.Item>
            );
        }

        return (
            <Form.Item name={field} noStyle>
                <Input
                    onBlur={(e) => saveField(field, e.target.value)}
                    onPressEnter={(e) => {
                        e.preventDefault();
                        saveField(field, e.target.value);
                    }}
                />
            </Form.Item>
        );
    };

    if (!record) return null;

    return (
        <Modal
            open={visible}
            onCancel={onClose}
            footer={null}
            destroyOnClose
            width="85%"
            style={{ top: modalTop }}
        >
            {/* HEADER */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 12,
                }}
            >
                <h3 style={{ margin: 0 }}>Дэлгэрэнгүй</h3>
            </div>

            {/* BODY */}
            <div style={{ display: "flex", minHeight: "65vh" }}>
                {/* LEFT CONTENT */}
                <div style={{ flex: 1, paddingRight: 16 }}>
                    <Form form={form} layout="vertical">
                        <Tabs
                            type="card"
                            activeKey={activeTab}
                            onChange={setActiveTab}
                        >
                            <Tabs.TabPane
                                key="general"
                                tab={<><FileTextOutlined /> Ерөнхий</>}
                            >
                                <Descriptions bordered column={1} size="small">
                                    {visibleFields.map((field) => (
                                        <Descriptions.Item
                                            key={field}
                                            label={fieldLabels[field] || field}
                                        >
                                            {renderField(field)}
                                        </Descriptions.Item>
                                    ))}
                                </Descriptions>
                            </Tabs.TabPane>

                            <Tabs.TabPane
                                key="finance"
                                tab={
                                    <>
                                        <DollarCircleOutlined />
                                        {isEvaluationCommittee
                                            ? " Үнэлгээний хороо"
                                            : " Нийгэмлэгийн комис"}
                                    </>
                                }
                            >
                                <Card>
                                    <Descriptions bordered column={1} size="small">
                                        {(isEvaluationCommittee
                                            ? ["ү_дарга", "ү_гишүүд", "ү_дугаар", "ү_огноо"]
                                            : NIIGEMLEG_FIELDS
                                        ).map((field) => (
                                            <Descriptions.Item
                                                key={field}
                                                label={fieldLabels[field] || field}
                                            >
                                                {renderField(field)}
                                            </Descriptions.Item>
                                        ))}
                                    </Descriptions>
                                </Card>
                            </Tabs.TabPane>

                            <Tabs.TabPane
                                key="items"
                                tab={<><ShoppingCartOutlined /> Захиалга</>}
                            >
                                <BasketItemsDetails
                                    basketIds={record.basket_ids}
                                    versionId={activeVersion}
                                />
                            </Tabs.TabPane>
                        </Tabs>
                    </Form>
                </div>

                {/* RIGHT VERSION FOLDERS */}
                <div
                    style={{
                        width: 220,
                        borderLeft: "1px solid #f0f0f0",
                        paddingLeft: 12,
                    }}
                >
                    <div style={{ marginTop: "auto", padding: "12px 0", textAlign: "center" }}>
                        <Tooltip title="Энэ товч дарснаар гэрээ үүсгэнэ" placement="right">
                            <Button
                                type="primary"
                                block
                                icon={<ExclamationCircleOutlined />}
                                onClick={onClose}
                            >
                                Гэрээ үүсгэх
                            </Button>
                        </Tooltip>
                    </div>
                    <div
                        style={{
                            fontWeight: 600,
                            marginBottom: 10,
                        }}
                    >
                        Түүх
                    </div>

                    {versions.map((v) => (
                        <div
                            key={v.id}
                            onClick={() => setActiveVersion(v.id)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 10px",
                                marginBottom: 6,
                                cursor: "pointer",
                                borderRadius: 6,
                                background:
                                    activeVersion === v.id
                                        ? "#e6f4ff"
                                        : "#fafafa",
                                border:
                                    activeVersion === v.id
                                        ? "1px solid #91caff"
                                        : "1px solid transparent",
                            }}
                        >
                            <FolderOpenOutlined />
                            {v.label}
                        </div>
                    ))}

                </div>
            </div>

        </Modal>
    );
};

export default TenderModal;
