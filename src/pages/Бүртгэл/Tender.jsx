import React, { useEffect, useState, useMemo } from "react";
import { Table, Progress, Descriptions, Input, DatePicker, Checkbox, Spin, Row, Col, Divider, message, Button, Statistic, Modal, Select, InputNumber, Dropdown, Menu, Radio, Form, Space } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
const { confirm } = Modal;
import { motion } from "framer-motion";
const { Search } = Input;

import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import BasketItemsDetails from "./BasketItemsDetails";
import "./Tender.css";

dayjs.extend(duration);
const { Timer } = Statistic;

const Tender = () => {
    const [tenders, setTenders] = useState([]);
    const [loading, setLoading] = useState(false);
    const userJson = localStorage.getItem("data");
    const user = userJson ? JSON.parse(userJson) : null;
    // 🚀 Modal-related states moved inside
    const [suspendVisible, setSuspendVisible] = useState(false);
    const [currentRecord, setCurrentRecord] = useState(null);
    const [suspendDate, setSuspendDate] = useState(null);
    const [activeTabs, setActiveTabs] = useState({});
    const [horooList, setHorooList] = useState([]);
    const [SelectedRecord, setSelectedRecord] = useState([]);
    const [form] = Form.useForm();
    const API_BASE_URL = import.meta.env.VITE_API_URL;
    const [expandedKeys, setExpandedKeys] = useState([]);
    const [columnFilters, setColumnFilters] = useState({});

    useEffect(() => {
        fetchTenders();
    }, []);
    const [searchText, setSearchText] = useState("");

    // ✅ Filter data by search text (checks all text columns)
    const filteredData = useMemo(() => {
        let data = tenders;

        // ✅ global search (existing)
        if (searchText) {
            const lower = searchText.toLowerCase();
            data = data.filter((item) =>
                Object.values(item).some(
                    (val) => val && val.toString().toLowerCase().includes(lower)
                )
            );
        }

        // ✅ column filters (new)
        Object.keys(columnFilters).forEach((key) => {
            const val = columnFilters[key]?.toLowerCase?.() || "";
            if (val) {
                data = data.filter((item) =>
                    (item[key] || "").toString().toLowerCase().includes(val)
                );
            }
        });

        return data;
    }, [searchText, columnFilters, tenders]);

    const [filterType, setFilterType] = useState("normal"); // "normal" | "suspended"
    const [selectedYear, setSelectedYear] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(null);

    const [expandedRowKeys, setExpandedRowKeys] = useState([]);

    const onRowClick = (record) => {
        setExpandedRowKeys((prev) =>
            prev.includes(record.key)
                ? prev.filter((key) => key !== record.key) // collapse if already expanded
                : [...prev, record.key] // expand if not expanded
        );
    };
    const renderColumnHeaderWithSearch = (title, dataIndex) => (
        <div
            style={{ display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()} // 🛑 prevent sorting when clicking input
        >
            <span style={{ fontWeight: 600 }}>{title}</span>
            <Input
                placeholder="Хайх..."
                allowClear
                size="small"
                value={columnFilters[dataIndex] || ""}
                onChange={(e) =>
                    setColumnFilters((prev) => ({
                        ...prev,
                        [dataIndex]: e.target.value,
                    }))
                }
                onClick={(e) => e.stopPropagation()} // 🛑 extra safety for click
                onFocus={(e) => e.stopPropagation()} // 🛑 prevent focus triggering sort
                style={{ marginTop: 4 }}
            />
        </div>
    );


    const fetchTenders = async (type = "normal", userId = user.id) => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE_URL}/get/GetTender`);
            const data = res.data || [];

            // Filter by tender type first
            let filtered = [];
            if (type === "normal") {
                filtered = data.filter(
                    (t) => t["түтгэлзүүлсэн_огноо"] === "1900-01-01T00:00:00Z"
                );
            } else if (type === "suspended") {
                filtered = data.filter(
                    (t) => t["түтгэлзүүлсэн_огноо"] !== "1900-01-01T00:00:00Z"
                );
            }

            // Then filter by created_by if userId is provided
            if (userId !== null) {
                if (user?.Erh !== "Удирдлага" && user?.erh !== "Удирдлага") {
                    filtered = filtered.filter((t) => t["created_by"] === userId);
                }
            }


            setTenders(filtered);
        } catch (err) {
            console.error("❌ Failed to fetch tenders:", err);
        } finally {
            setLoading(false);
        }
    };




    const isEmpty = (val) => {
        if (val === null || val === "" || val === undefined || val === 0) return true;
        if (typeof val === "string" && val.startsWith("1900-01-01")) return true;
        return false;
    };

    const handleUpdate = async (id, field, value) => {
        console.log("Updating:", { id, field, value });
        try {
            await axios.put(`${API_BASE_URL}/put/UpdateTender/${id}`, {
                field,
                value,
            });
            message.success(`${field} шинэчлэгдлээ`);
            fetchTenders();
        } catch (err) {
            console.error("❌ Update failed:", err);
            message.error("Шинэчлэхэд алдаа гарлаа");
        }
    };

    const handleSuspend = (record) => {
        setCurrentRecord(record);
        setSuspendVisible(true);
    };

    const handleSuspendSave = async () => {
        if (!suspendDate) {
            message.warning("Түгэлзүүлсэн огноо оруулна уу!");
            return;
        }
        await handleUpdate(
            currentRecord.tender_id,
            "түтгэлзүүлсэн_огноо",
            suspendDate.format("YYYY-MM-DD HH:mm:ss")
        );
        setSuspendVisible(false);
        setSuspendDate(null);
        setCurrentRecord(null);
    };

    const calcCompletion = (record, mode) => {
        // console.log("Calculating completion for mode:", mode, record.tender_id);

        if (mode === "default") {
            // ✅ Count all non-empty fields except excluded ones
            const fields = Object.keys(record).filter(
                (key) =>
                    ![
                        "tender_id",
                        "created_at",
                        "created_by",
                        "гомдол_гаргасан_огноо", // 🚀 exclude
                        "тендерт_оролцогч",
                        "түтгэлзүүлсэн_огноо",
                        "зүк_дугаар",
                        "зүк_огноо",
                    ].includes(key)
            );

            let filled = 0;
            const emptyFields = []; // 🚀 track missing ones

            fields.forEach((f) => {
                if (!isEmpty(record[f])) filled++;
                else emptyFields.push(f);
            });

            const percent =
                fields.length > 0 ? Math.round((filled / fields.length) * 100) : 0;

            // 🪵 Log what's missing for debugging
            console.log(
                `Record ${record.tender_id || ""} — ${percent}% complete`,
                "\nMissing fields:",
                emptyFields
            );

            return percent;
        }


        if (mode === "zuk") {
            // ✅ Only require these specific fields
            const fields = [
                "шалгаруулалтын_төрөл",
                "тендерийн_төрөл",
                "батлагдсан_төсөвт_өртөг",
                "гэрээ_байгуулах_эрх_олгосон_огноо",
                "тайлбар",
            ];

            const filled = fields.filter((f) => !isEmpty(record[f])).length;
            return Math.round((filled / fields.length) * 100);
        }


        if (mode === "finance") {
            // ✅ ЗҮК → дугаар + огноо
            const fields = ["зүк_дугаар", "зүк_огноо"];
            const allFilled = fields.every((f) => !isEmpty(record[f]));
            return allFilled ? 100 : 0;
        }

        return 0; // fallback
    };


    // Separate component for countdown + progress
    const ProgressCountdown = ({ record, mode }) => {
        const start = dayjs(record["тендер_нээх_огноо"]);
        const end = dayjs(record["тендер_хаах_огноо"]);

        if (!start.isValid() || !end.isValid()) return "Огноо оруулаагүй";

        const totalMs = end.diff(start);
        const percent = calcCompletion(record, mode);
        const isFinished = percent === 100;
        console.log(`Progress for ${record.tender_id} (${mode}):`, { percent, isFinished });
        useEffect(() => {
            const timer = setInterval(() => {
                const now = dayjs();
                Math.min(100, Math.max(0, (now.diff(start) / totalMs) * 100));
            }, 1000);
            return () => clearInterval(timer);
        }, [start, totalMs]);
        const orgs = [
            ...new Set(record.Organization.split(",").map(o => o.trim()))
        ];
        console.log("Organization list:", record);
        // 🚀 "нх"-г нэмээд явуулна
        const choices = [...orgs, "НХ"];

        const [selected, setSelected] = useState(choices[0]); // default
        const [isModalVisible, setIsModalVisible] = useState(false);
        useEffect(() => {
            if (isModalVisible) {
                setLoading(true);
                axios
                    .get(API_BASE_URL + "/get/GetUsers")
                    .then((res) => {
                        const data = res.data || [];
                        const filtered = data.filter((u) => u.erh === "Гэрээний мэргэжилтэн");
                        setUsers(filtered);
                    })
                    .catch(() => message.error("Хэрэглэгчийн мэдээлэл татахад алдаа гарлаа!"))
                    .finally(() => setLoading(false));
            }
        }, [isModalVisible]);

        const handleUserSelect = (value) => {
            setSelectedUser(value === selectedUser ? null : value); // toggle
        };

        const handleOrgSelect = (value) => {
            setSelectedOrg(value === selectedOrg ? null : value); // toggle
        };

        const handleOk = async () => {
            console.log("✅ Сонгогдсон гэрээний мэргэжилтэн ID:", selectedUser);
            console.log("✅ Сонгогдсон байгууллага:", selectedOrg);

            if (!selectedOrg || !selectedUser) {
                message.warning("Байгууллага болон гэрээний мэргэжилтэнг сонгоно уу");
                return;
            }

            try {
                setLoading(true);
                message.loading({ content: "Гэрээ үүсгэж байна...", key: "ger" });

                const payload = {
                    TenderId: record.tender_id,
                    Гэрээний_дугаар: `GR-${Date.now()}`,
                    Гэрээ_байгуулсан_огноо: new Date().toISOString(),
                    Гэрээ_байгуулсан_ААН: selectedOrg,
                    ААН_регистер: record.ААН_регистер || "",
                    Хүчинтэй_хугацаа: record.Хүчинтэй_хугацаа || "",
                    Валют: record.Валют || "MNT",
                    Гэрээний_дүн: record.Гэрээний_дүн || 0,
                    Төлбөрийн_нөхцөл: record.Төлбөрийн_нөхцөл || "",
                    Төлбөрийн_огноо: record.Төлбөрийн_огноо || null,
                    Төлбөр_хийх_хугацаа: record.Төлбөр_хийх_хугацаа || null,
                    Нийлүүлэх_нөхцөл: record.Нийлүүлэх_нөхцөл || "",
                    Нийлүүлэх_хугацаа: record.Нийлүүлэх_хугацаа || null,
                    Алдангийн_нөхцөл: record.Алдангийн_нөхцөл || "",
                    Гэрээ_хэрэгжилтийн_явц: record.Гэрээ_хэрэгжилтийн_явц || "",
                    Тодруулга: record.Тодруулга || "",
                    Дүгнэлт: record.Дүгнэлт || "",
                    Санамж: record.Санамж || "",
                    Гэрээний_төлөв: "ШИНЭ",
                    BasketIds: record.basket_ids || "",
                    GereeUserId: selectedUser,
                };

                console.log("📤 Sending payload:", payload);
                await axios.post(`${API_BASE_URL}/post/PostGeree`, payload);

                message.success({
                    content: "Гэрээ амжилттай үүсгэгдлээ",
                    key: "ger",
                });
            } catch (err) {
                console.error("❌ Failed to create Geree:", err);
                message.error({
                    content: "Гэрээ үүсгэхэд алдаа гарлаа",
                    key: "ger",
                });
            } finally {
                setLoading(false);
                setIsModalVisible(false);
            }
        };
        const [loading, setLoading] = useState(false);
        const [users, setUsers] = useState([]);
        const [selectedUser, setSelectedUser] = useState(null);
        const [selectedOrg, setSelectedOrg] = useState(null);
        const menu = (
            <Menu
                onClick={async (e) => {
                    try {
                        setSelected(e.key);
                        message.loading({ content: "Гэрээ үүсгэж байна...", key: "ger" });
                        console.log("record:", record);
                        // 🔥 API руу record + сонгосон утга илгээж байна
                        const payload = {
                            TenderId: record.tender_id, // тендерийн ID
                            Гэрээний_дугаар: `GR-${Date.now()}`, // түр гэрээний дугаар жишээ болгож үүсгэв
                            Гэрээ_байгуулсан_огноо: new Date().toISOString(),
                            Гэрээ_байгуулсан_ААН: selectedOrg, // сонгосон байгууллага
                            ААН_регистер: record.ААН_регистер || "",
                            Хүчинтэй_хугацаа: record.Хүчинтэй_хугацаа || "",
                            Валют: record.Валют || "MNT",
                            Гэрээний_дүн: record.Гэрээний_дүн || 0,
                            Төлбөрийн_нөхцөл: record.Төлбөрийн_нөхцөл || "",
                            Төлбөрийн_огноо: record.Төлбөрийн_огноо || null,
                            Төлбөр_хийх_хугацаа: record.Төлбөр_хийх_хугацаа || null,
                            Нийлүүлэх_нөхцөл: record.Нийлүүлэх_нөхцөл || "",
                            Нийлүүлэх_хугацаа: record.Нийлүүлэх_хугацаа || null,
                            Алдангийн_нөхцөл: record.Алдангийн_нөхцөл || "",
                            Гэрээ_хэрэгжилтийн_явц: record.Гэрээ_хэрэгжилтийн_явц || "",
                            Тодруулга: record.Тодруулга || "",
                            Дүгнэлт: record.Дүгнэлт || "",
                            Санамж: record.Санамж || "",
                            Гэрээний_төлөв: "ШИНЭ", // default
                            BasketIds: record.basket_ids || "", // сагсны ID-үүд
                            GereeUserId: selectedUser,
                        };

                        console.log("📤 Sending payload:", payload);

                        await axios.post(`${API_BASE_URL}/post/PostGeree`, payload);

                        message.success({
                            content: `${e.key} гэрээ амжилттай үүсгэгдлээ`,
                            key: "ger",
                        });
                    } catch (err) {
                        console.error("❌ Failed to create Geree:", err);
                        message.error({
                            content: "Гэрээ үүсгэхэд алдаа гарлаа",
                            key: "ger",
                        });
                    }
                }}
            >
                {choices.map((org) => (
                    <Menu.Item key={org}>{org}</Menu.Item>
                ))}
            </Menu>
        );
        return (

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                <Progress percent={percent} size="small" />
                <Timer
                    type="countdown"
                    value={end.toDate()}
                    format="DD [өдөр] HH [цаг] mm [мин] ss [сек]"
                    valueStyle={{ fontSize: 12, color: isFinished ? "red" : "green", marginTop: 4 }}
                />
                {/* 🚀 Buttons */}
                {percent === 100 ? (
                    // <Dropdown overlay={menu} trigger={["click"]}>
                    <Button
                        type="primary"
                        onClick={() => setIsModalVisible(true)}
                        disabled={
                            user?.erh === "Удирдлага" || user?.Erh === "Удирдлага"
                        }
                    >
                        Гэрээ үүсгэх
                    </Button>
                    // </Dropdown>

                ) : (
                    <>
                        {filterType === "suspended" ? (
                            <Button
                                type="primary"
                                danger
                                size="small"
                                style={{ marginTop: 8 }}
                                onClick={() => {
                                    confirm({
                                        title: "Та итгэлтэй байна уу?",
                                        content: "Энэ тендерийн түтгэлзүүлсэн огноог цуцлах гэж байна.",
                                        okText: "Тийм",
                                        cancelText: "Үгүй",
                                        onOk: () => {
                                            handleUpdate(
                                                record.tender_id,
                                                "түтгэлзүүлсэн_огноо",
                                                "1900-01-01T00:00:00Z"
                                            );
                                            setFilterType("normal");
                                            fetchTenders("normal");
                                        },
                                    });
                                }}
                                disabled={isFinished}
                            >
                                Түтгэлзүүлсэн цуцлах
                            </Button>

                        ) : (
                            <Button
                                type="primary"
                                danger
                                size="small"
                                style={{ marginTop: 8 }}
                                onClick={() => handleSuspend(record)}
                                disabled={isFinished}
                            >
                                Түдгэлзүүлэх
                            </Button>
                        )}
                    </>
                )}
                <Modal
                    title="Гэрээний мэргэжилтэн ба байгууллага сонгох"
                    open={isModalVisible}
                    onOk={handleOk}
                    onCancel={() => setIsModalVisible(false)}
                    okText="Хадгалах"
                    cancelText="Болих"
                    width={700}
                >
                    {loading ? (
                        <Spin />
                    ) : (
                        <Row gutter={24}>
                            {/* ✅ Left Column — Гэрээний мэргэжилтэн */}
                            <Col span={12}>
                                <h4>Гэрээний мэргэжилтэн</h4>
                                <Divider style={{ margin: "8px 0" }} />
                                {users.length > 0 ? (
                                    users.map((user) => (
                                        <Checkbox
                                            key={user.id}
                                            checked={selectedUser === user.id}
                                            onChange={() => handleUserSelect(user.id)}
                                        >
                                            {user.ovog} {user.ner}
                                        </Checkbox>
                                    ))
                                ) : (
                                    <p>Гэрээний мэргэжилтэн олдсонгүй.</p>
                                )}
                            </Col>

                            {/* ✅ Right Column — Байгууллагууд */}
                            <Col span={12}>
                                <h4>Гэрээ үүсгэх байгууллага</h4>
                                <Divider style={{ margin: "8px 0" }} />
                                {choices && choices.length > 0 ? (
                                    choices.map((org) => (
                                        <Checkbox
                                            key={org}
                                            checked={selectedOrg === org}
                                            onChange={() => handleOrgSelect(org)}
                                        >
                                            {org}
                                        </Checkbox>
                                    ))
                                ) : (
                                    <p>Байгууллага байхгүй байна.</p>
                                )}
                            </Col>
                        </Row>
                    )}
                </Modal>
            </div >
        );
    };

    const renderField = (record, field, type = "text") => {
        const value = record[field];
        const isUdirdlaga = user?.erh === "Удирдлага" || user?.Erh === "Удирдлага";

        if (isUdirdlaga) {
            if (type === "datetime" || type === "date") {
                return value
                    ? dayjs(value).format(type === "datetime" ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD")
                    : "";
            }
            if (field === "батлагдсан_төсөвт_өртөг") {
                return value ? `${Number(value).toLocaleString()}` : "";
            }
            if (field === "шалгаруулалтын_төрөл" || field === "тендерийн_төрөл") {
                return value || "";
            }
            if (type === "checkbox") {
                return value ? "✅ Тийм" : "❌ Үгүй";
            }
            return value || "";
        }

        if (field === "шалгаруулалтын_төрөл") {
            return (
                <Select
                    placeholder="Төрөл сонгох"
                    style={{ width: "100%" }}
                    value={isEmpty(value) ? undefined : value}
                    onChange={(val) => handleUpdate(record.tender_id, field, val)}
                >
                    <Select.Option value="Бараа">Бараа</Select.Option>
                    <Select.Option value="Ажил үйлчилгээ">Ажил үйлчилгээ</Select.Option>
                    <Select.Option value="Зөвлөх үйлчилгээ">Зөвлөх үйлчилгээ</Select.Option>
                </Select>
            );
        }

        if (field === "тендерийн_төрөл") {
            return (
                <Select
                    placeholder="Төрөл сонгох"
                    style={{ width: "100%" }}
                    value={isEmpty(value) ? undefined : value}
                    onChange={(val) => handleUpdate(record.tender_id, field, val)}
                >
                    <Select.Option value="НТШ">НТШ</Select.Option>
                    <Select.Option value="ХА">ХА</Select.Option>
                    <Select.Option value="Нэг эх үүсвэр">Нэг эх үүсвэр</Select.Option>
                    <Select.Option value="Гэрээ шууд байгуулах">Гэрээ шууд байгуулах</Select.Option>
                </Select>
            );
        }

        if (field === "батлагдсан_төсөвт_өртөг") {
            return isEmpty(value) ? (
                <InputNumber
                    style={{ width: "100%" }}
                    placeholder="төсөв оруулах"
                    onBlur={(e) => handleUpdate(record.tender_id, field, e.target.value)}
                    onPressEnter={(e) => handleUpdate(record.tender_id, field, e.target.value)}
                />
            ) : (
                `${Number(value).toLocaleString()}`
            );
        }

        if (type === "datetime") {
            return isEmpty(value) ? (
                <DatePicker
                    showTime
                    onChange={(date) =>
                        handleUpdate(record.tender_id, field, date.format("YYYY-MM-DD HH:mm:ss"))
                    }
                />
            ) : (
                dayjs(value).format("YYYY-MM-DD HH:mm:ss")
            );
        }

        if (type === "date") {
            return isEmpty(value) ? (
                <DatePicker
                    onChange={(date) =>
                        handleUpdate(record.tender_id, field, date.format("YYYY-MM-DD"))
                    }
                />
            ) : (
                dayjs(value).format("YYYY-MM-DD")
            );
        }

        if (type === "checkbox") {
            return isEmpty(value) ? (
                <Checkbox
                    onChange={(e) => handleUpdate(record.tender_id, field, e.target.checked)}
                >
                    Сонгох
                </Checkbox>
            ) : value ? (
                "✅ Тийм"
            ) : (
                "❌ Үгүй"
            );
        }

        // ✅ text fields auto-save on blur or enter
        return isEmpty(value) ? (
            <Input
                placeholder={`${fieldLabels[field]} оруулах`}
                onBlur={(e) => {
                    const newValue = e.target.value.trim();
                    if (newValue !== "") {
                        handleUpdate(record.tender_id, field, newValue);
                    }
                }}
                onPressEnter={(e) => {
                    const newValue = e.target.value.trim();
                    if (newValue !== "") {
                        handleUpdate(record.tender_id, field, newValue);
                    }
                }}
            />
        ) : (
            value
        );
    };

    const columns = [
        ...(user?.erh === "Удирдлага"
            ? [
                {
                    title: renderColumnHeaderWithSearch("Тендерийг үүсгэсэн", "CreatedBy"),
                    key: "CreatedBy",
                    render: (text, record) => `${record.Ovog || ""} ${record.Ner || ""}`,
                    sorter: (a, b) =>
                        `${a.Ovog || ""} ${a.Ner || ""}`.localeCompare(
                            `${b.Ovog || ""} ${b.Ner || ""}`
                        ),
                },
            ]
            : []),
        {
            title: renderColumnHeaderWithSearch("Тендерийн дугаар", "тендерийн_дугаар"),
            dataIndex: "тендерийн_дугаар",
            key: "tender_number",
            sorter: (a, b) =>
                (a["тендерийн_дугаар"] || "").localeCompare(b["тендерийн_дугаар"] || ""),
        },
        {
            title: renderColumnHeaderWithSearch("Тендерийн нэр", "tender_name"),
            dataIndex: "tender_name",
            key: "tender_name",
            ellipsis: true,
            sorter: (a, b) => (a.tender_name || "").localeCompare(b.tender_name || ""),
        },
        {
            title: "Явц",
            key: "progress",
            sorter: (a, b) => {
                const typeA = a["тендерийн_төрөл"]?.trim();
                const typeB = b["тендерийн_төрөл"]?.trim();

                const percentA = ["НТШ", "ХА"].includes(typeA)
                    ? calcCompletion(a, "default")
                    : calcCompletion(a, "zuk");

                const percentB = ["НТШ", "ХА"].includes(typeB)
                    ? calcCompletion(b, "default")
                    : calcCompletion(b, "zuk");

                return percentA - percentB;
            },
            sortDirections: ["ascend", "descend"],
            render: (_, record) => {
                const tenderType = record["тендерийн_төрөл"]?.trim();
                if (["НТШ", "ХА"].includes(tenderType)) {
                    return <ProgressCountdown record={record} mode="default" />;
                } else if (
                    ["Нэг эх үүсвэр", "Гэрээ шууд байгуулах"].includes(tenderType)
                ) {
                    return <ProgressCountdown record={record} mode="zuk" />;
                }
                return null;
            },
        },
    ];


    const fieldLabels = {
        шалгаруулалтын_төрөл: "Шалгаруулалтын төрөл",
        тендерийн_төрөл: "Тендер шалгаруулалтын арга",
        батлагдсан_төсөвт_өртөг: "Батлагдсан төсөвт өртөг",
        урилгийн_дугаар: "Урилгийн дугаар",
        урилгийн_огноо: "Урилгийн огноо",
        тендер_нээх_огноо: "Тендер нээх огноо",
        тендер_хаах_огноо: "Тендер хаах огноо",
        үнэлгээ_хийсэн_огноо: "Үнэлгээ хийсэн огноо",
        мэдэгдэл_тараасан_огноо: "Мэдэгдэл тараасан огноо",
        гэрээ_байгуулах_эрх_олгосон_огноо: "Гэрээ байгуулах эрх олгосон огноо",
        гомдол_гаргасан_огноо: "Гомдол гаргасан огноо",
        тендерийн_явц_шалтгаан: "Тендерийн явц шалтгаан",
        тайлбар: "Тайлбар",
        ү_дарга: "Үнэлгээний хороо дарга",
        ү_гишүүд: "Үнэлгээний хороо гишүүд",
        ү_дугаар: "Үнэлгээний хороо дугаар",
        ү_огноо: "Үнэлгээний хороо огноо",
        зүк_дугаар: "Замын үнийн комис дугаар",
        зүк_огноо: "Замын үнийн комис огноо",
        Organization: "Байгууллага",
        // бусад field-үүдийн Монгол нэрийг энд нэмнэ
        // бусад field-үүдийг энд нэмээд явж болно
    };

    return (
        <>
            {/* <Input
                placeholder="Хайх..."
                allowClear
                onChange={(e) => setSearchText(e.target.value)}
                style={{ maxWidth: 300, marginBottom: 8 }}
            /> */}
            <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
                <Button
                    type={filterType === "normal" ? "primary" : "default"}
                    onClick={() => {
                        setFilterType("normal");
                        fetchTenders("normal");
                    }}
                >
                    Энгийн
                </Button>

                <Button
                    type={filterType === "suspended" ? "primary" : "default"}
                    danger
                    onClick={() => {
                        setFilterType("suspended");
                        fetchTenders("suspended");
                    }}
                >
                    Түдгэлзүүлсэн
                </Button>
            </div>
            {/* Year filter */}
            <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
                {["2024", "2025", "2026"].map((year) => (
                    <Button
                        key={year}
                        type={selectedYear === year ? "primary" : "default"}
                        disabled
                        onClick={() => setSelectedYear(year)}
                    >
                        {year}
                    </Button>
                ))}
            </div>


            {/* Month filter */}
            {/* <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <Button
                        key={month}
                        type={selectedMonth === month ? "primary" : "default"}
                        onClick={() => setSelectedMonth(month)}
                    >
                        {month}
                    </Button>
                ))}
            </div> */}
            <Table
                dataSource={filteredData}
                columns={columns}
                rowKey="tender_id"
                loading={loading}
                bordered
                style={{ tableLayout: "fixed" }}
                scroll={{
                    x: "100%",
                    y: 800,
                }}
                expandable={{
                    expandedRowRender: (record) => {
                        const activeTab = activeTabs[record.tender_id] || "general";
                        const isZUK =
                            record["тендерийн_төрөл"]?.trim().toLowerCase() === "замын үнийн комис";
                        const isUdir =
                            user?.erh === "Удирдлага" || user?.Erh === "Удирдлага";

                        return (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                style={{
                                    background: "#fafafa",
                                    padding: 12,
                                    borderRadius: 8,
                                }}
                            >
                                <Radio.Group
                                    value={activeTab}
                                    onChange={(e) =>
                                        setActiveTabs((prev) => ({
                                            ...prev,
                                            [record.tender_id]: e.target.value,
                                        }))
                                    }
                                    style={{
                                        marginBottom: 16,
                                        display: "flex",
                                        width: "100%",
                                    }}
                                    buttonStyle="solid"
                                >
                                    <Radio.Button
                                        value="general"
                                        style={{
                                            flex: 1,
                                            textAlign: "center",
                                            width: isZUK ? "50%" : "33.33%",
                                        }}
                                    >
                                        Ерөнхий
                                    </Radio.Button>

                                    <Radio.Button
                                        value="finance"
                                        style={{
                                            flex: 1,
                                            textAlign: "center",
                                            width: isZUK ? "50%" : "33.33%",
                                        }}
                                    >
                                        {["НТШ", "ХА"].includes(record["тендерийн_төрөл"])
                                            ? "Үнэлгээний хороо"
                                            : "Нийгэмлэгийн сонгон шалгаруулах комис"}
                                    </Radio.Button>

                                    <Radio.Button
                                        value="Items"
                                        style={{
                                            flex: 1,
                                            textAlign: "center",
                                            width: isZUK ? "50%" : "33.33%",
                                        }}
                                    >
                                        Захиалга
                                    </Radio.Button>
                                </Radio.Group>

                                {/* ✅ Tab content */}
                                {activeTab === "Items" && (
                                    <BasketItemsDetails basketIds={record.basket_ids} />
                                )}

                                {activeTab === "general" && (
                                    <Descriptions
                                        bordered
                                        column={1}
                                        size="small"
                                        styles={{
                                            label: { width: 300, fontWeight: "bold" },
                                            content: { width: 600 },
                                        }}
                                    >
                                        {(
                                            ["НТШ", "ХА"].includes(
                                                record["тендерийн_төрөл"]?.trim()
                                            )
                                                ? Object.keys(record).filter(
                                                    (field) =>
                                                        ![
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
                                                        ].includes(field)
                                                )
                                                : [
                                                    "шалгаруулалтын_төрөл",
                                                    "тендерийн_төрөл",
                                                    "батлагдсан_төсөвт_өртөг",
                                                    "гэрээ_байгуулах_эрх_олгосон_огноо",
                                                    "тайлбар",
                                                ]
                                        ).map((field) => {
                                            let type = "text";
                                            if (
                                                field === "тендер_нээх_огноо" ||
                                                field === "тендер_хаах_огноо"
                                            )
                                                type = "datetime";
                                            else if (field.includes("огноо")) type = "date";

                                            return (
                                                <Descriptions.Item
                                                    key={field}
                                                    label={fieldLabels[field] || field}
                                                >
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 8,
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                flex: 1,
                                                                opacity: isUdir ? 0.7 : 1,
                                                            }}
                                                        >
                                                            {renderField(record, field, type)}
                                                        </div>
                                                        {!isUdir &&
                                                            record[field] &&
                                                            record[field] !== "" && (
                                                                <Button
                                                                    type="text"
                                                                    danger
                                                                    size="small"
                                                                    onClick={() =>
                                                                        handleUpdate(
                                                                            record.tender_id,
                                                                            field,
                                                                            ""
                                                                        )
                                                                    }
                                                                >
                                                                    Засах
                                                                </Button>
                                                            )}
                                                    </div>
                                                </Descriptions.Item>
                                            );
                                        })}
                                    </Descriptions>
                                )}

                                {activeTab === "finance" && (
                                    <Descriptions
                                        bordered
                                        column={1}
                                        size="small"
                                        styles={{
                                            label: {
                                                minWidth: 300,
                                                fontWeight: "bold",
                                            },
                                            content: { minWidth: 600 },
                                        }}
                                    >
                                        {(
                                            ["НТШ", "ХА"].includes(
                                                record["тендерийн_төрөл"]?.trim()
                                            )
                                                ? ["ү_дарга", "ү_гишүүд", "ү_дугаар", "ү_огноо"]
                                                : ["зүк_дугаар", "зүк_огноо"]
                                        ).map((field) => {
                                            let type = "text";
                                            if (field.includes("огноо")) type = "date";

                                            return (
                                                <Descriptions.Item
                                                    key={field}
                                                    label={fieldLabels[field] || field}
                                                >
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 8,
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                flex: 1,
                                                                opacity: isUdir ? 0.7 : 1,
                                                            }}
                                                        >
                                                            {renderField(record, field, type)}
                                                        </div>
                                                        {!isUdir && record[field] && (
                                                            <Button
                                                                type="text"
                                                                danger
                                                                size="small"
                                                                onClick={() =>
                                                                    handleUpdate(
                                                                        record.tender_id,
                                                                        field,
                                                                        ""
                                                                    )
                                                                }
                                                            >
                                                                Засах
                                                            </Button>
                                                        )}
                                                    </div>
                                                </Descriptions.Item>
                                            );
                                        })}
                                    </Descriptions>
                                )}
                            </motion.div>
                        );
                    },
                    expandedRowKeys: expandedKeys,
                    onExpand: (expanded, record) => {
                        if (expanded) setSelectedRecord(record);
                        setExpandedKeys((prev) =>
                            expanded
                                ? [...prev, record.tender_id]
                                : prev.filter((id) => id !== record.tender_id)
                        );
                    },
                    expandRowByClick: true, // 👈 makes row clickable for expand/collapse
                }}
                onRow={(record) => ({
                    onClick: () => {
                        const isExpanded = expandedKeys.includes(record.tender_id);
                        setExpandedKeys((prev) =>
                            isExpanded
                                ? prev.filter((id) => id !== record.tender_id)
                                : [...prev, record.tender_id]
                        );
                    },
                    className: expandedKeys.includes(record.tender_id)
                        ? "expanded-row"
                        : "",
                })}
                pagination={true}
            />



            {/* 🚀 Modal */}
            <Modal
                title="Түтгэлзүүлэх огноо оруулах"
                open={suspendVisible}
                onOk={handleSuspendSave}
                onCancel={() => setSuspendVisible(false)}
            >
                <DatePicker
                    showTime
                    style={{ width: "100%" }}
                    placeholder="Түтгэлзүүлсэн огноо сонгох"
                    value={suspendDate}
                    onChange={(val) => setSuspendDate(val)}
                />
            </Modal>
        </>
    );
};

export default Tender;
