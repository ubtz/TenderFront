// Явц2.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    Card,
    Steps,
    Typography,
    Tag,
    Spin,
    message,
    Divider,
    Space,
    Row,
    Col,
    Progress,
    List,
    Drawer,
    Input,
    Timeline,
    Empty,
    Pagination,
} from "antd";
import {
    ShoppingCartOutlined,
    SolutionOutlined,
    FileDoneOutlined,
    CheckOutlined,
    UnorderedListOutlined,
    ClockCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Search } = Input;

/* =========================
   UI STEP CONFIG
========================= */
const stepData = [
    { key: "request", title: "Захиалга ирсэн", color: "blue", icon: <ShoppingCartOutlined /> },
    { key: "tender", title: "Тендерийн шат", color: "orange", icon: <SolutionOutlined /> },
    { key: "contract", title: "Гэрээ байгуулах", color: "purple", icon: <FileDoneOutlined /> },
    { key: "delivery", title: "Бараа хүлээн авалт", color: "green", icon: <CheckOutlined /> },
];

/* =========================
   BACKEND → UI STEP MAP
========================= */
const BACKEND_TO_UI_STEP = {
    created_by_company: "request",
    sent_to_department: "request",
    department_to_nh: "request",
    nh_assigned: "request",
    planned_by_specialist: "request",
    tender_started: "tender",
    contract_signed: "contract",
    delivered: "delivery",
};

/* =========================
   HELPERS
========================= */
const getText = (v) =>
    v && typeof v === "object" && "String" in v ? v.String || "" : v ?? "";

const unwrapNumber = (v) => {
    if (!v) return 0;
    if (typeof v === "object" && v.Valid) {
        if (typeof v.Float64 === "number") return v.Float64;
        if (typeof v.Int64 === "number") return v.Int64;
    }
    return Number(v) || 0;
};

const formatDateTime = (v) => {
    const raw = getText(v);
    return raw ? dayjs(raw).format("YYYY-MM-DD HH:mm:ss") : "";
};

const formatDate = (v) => {
    const raw = getText(v);
    return raw ? String(raw) : "";
};

/* =========================
   SEARCH
========================= */
const normalize = (v) =>
    getText(v).toLowerCase().replace(/\s+/g, " ").trim();

const matchSearch = (item, query) => {
    if (!query) return true;

    const q = normalize(query);
    const tokens = q.split(" ");

    const mainText = normalize(
        [
            getText(item.cr4name),
            getText(item.crmarkname),
            getText(item.dname),
            getText(item.mdocno),
            getText(item.usize),
        ].join(" ")
    );

    if (normalize(getText(item.code)).includes(q)) return true;
    if (normalize(getText(item.pkgdate)).includes(q)) return true;

    return tokens.every((t) => mainText.includes(t));
};


const getRowId = (item, index) =>
    item.basket_item_id ?? `${getText(item.code)}-${index}`;

/* =========================
   COMPONENT
========================= */
const Явц2 = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    const [searchText, setSearchText] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    const [selectedItem, setSelectedItem] = useState(null);
    const [activeId, setActiveId] = useState(null);

    const [itemSteps, setItemSteps] = useState([]);
    const [stepsLoading, setStepsLoading] = useState(false);
    const API_BASE_URL = import.meta.env.VITE_API_URL;
    /* =========================
       FETCH ITEMS
    ========================= */
    useEffect(() => {
        const fetchItems = async () => {
            try {
                setLoading(true);
                const res = await axios.get(`${API_BASE_URL}/get/GetBasketItems`);
                setItems(res.data || []);
            } catch {
                message.error("Өгөгдөл татаж чадсангүй");
            } finally {
                setLoading(false);
            }
        };
        fetchItems();
    }, []);

    /* =========================
       FILTER + PAGINATION
    ========================= */
    const filteredItems = useMemo(() => {
        if (!searchText.trim()) return items;
        return items.filter((i) => matchSearch(i, searchText));
    }, [items, searchText]);

    useEffect(() => setPage(1), [searchText]);

    const pagedItems = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredItems.slice(start, start + PAGE_SIZE);
    }, [filteredItems, page]);

    /* =========================
       PER-ITEM STEP (LIST)
    ========================= */
    const getUiStepFromItem = (item) => {
        const backendKey = getText(item.current_step_key);
        const uiKey = BACKEND_TO_UI_STEP[backendKey] || "request";
        const idx = stepData.findIndex((s) => s.key === uiKey);
        return idx >= 0 ? idx : 0;
    };
    // helper: unwrap sql.NullString or raw value
    const getFieldText = (v) => {
        if (v && typeof v === "object" && "String" in v) {
            return v.String || "";
        }
        return v ?? "";
    };

    /* =========================
       FETCH STEPS (DRAWER)
    ========================= */
    useEffect(() => {
        if (!selectedItem?.basket_item_id) return;

        const fetchSteps = async () => {
            try {
                setStepsLoading(true);
                const res = await axios.get(
                    `${API_BASE_URL}/get/GetItemSteps/${selectedItem.basket_item_id}`
                );
                console.log("Item Steps:", res.data);
                setItemSteps(res.data || []);
            } catch {
                message.error("Явцын мэдээлэл татаж чадсангүй");
                setItemSteps([]);
            } finally {
                setStepsLoading(false);
            }
        };

        fetchSteps();
    }, [selectedItem]);

    /* =========================
       CURRENT STEP (DRAWER)
    ========================= */
    const currentStepIndex = useMemo(() => {
        const current = itemSteps.find((s) => s.is_current);
        if (!current) return 0;

        const uiKey = BACKEND_TO_UI_STEP[current.step_key] || "request";
        const idx = stepData.findIndex((s) => s.key === uiKey);
        return idx >= 0 ? idx : 0;
    }, [itemSteps]);

    return (
        <Card bordered={false} style={{ borderRadius: 16 }}>
            <Title level={4}>Бараа материалын захиалгаар хайх</Title>
            <Divider />

            <Search
                placeholder="Нэр, марк, алба, огноо, кодоор хайх"
                allowClear
                style={{ maxWidth: 420, marginBottom: 16 }}
                onChange={(e) => setSearchText(e.target.value)}
            />

            {loading ? (
                <Spin />
            ) : pagedItems.length === 0 ? (
                <Empty description="Өгөгдөл олдсонгүй" />
            ) : (
                <>
                    <List
                        dataSource={pagedItems}
                        rowKey={getRowId}
                        renderItem={(item, index) => {
                            const rowId = getRowId(item, index);
                            const rowStepIndex = getUiStepFromItem(item);
                            const isActive = activeId === rowId;

                            return (
                                <List.Item
                                    onClick={() => {
                                        setActiveId(rowId);
                                        setSelectedItem(item);
                                    }}
                                    style={{
                                        cursor: "pointer",
                                        padding: 12,
                                        borderRadius: 8,
                                        background: isActive ? "#e6f4ff" : "#fff",
                                        border: isActive
                                            ? "1px solid #1677ff"
                                            : "1px solid transparent",
                                    }}
                                >
                                    <Row gutter={12} style={{ width: "100%" }}>
                                        <Col span={8}>
                                            <Text strong>{getText(item.cr4name)}</Text>
                                            <div>Марк: {getText(item.crmarkname)}</div>
                                            <div>ААН: {getText(item.dname)}</div>
                                            <div>Огноо: {formatDate(item.pkgdate)}</div>
                                        </Col>

                                        <Col span={10}>
                                            <Tag color={stepData[rowStepIndex].color}>
                                                {stepData[rowStepIndex].title}
                                            </Tag>
                                            <Progress
                                                percent={Math.round(
                                                    ((rowStepIndex + 1) / stepData.length) * 100
                                                )}
                                                size="small"
                                            />
                                        </Col>

                                        <Col span={6} style={{ textAlign: "right" }}>
                                            {unwrapNumber(item.pricesum).toLocaleString()} ₮
                                            <div>{unwrapNumber(item.qty)} ширхэг</div>
                                        </Col>
                                    </Row>
                                </List.Item>
                            );
                        }}
                    />

                    <Divider />

                    <Pagination
                        current={page}
                        pageSize={PAGE_SIZE}
                        total={filteredItems.length}
                        onChange={setPage}
                        showSizeChanger={false}
                        showTotal={(t) => `Нийт ${t} мөр`}
                    />
                </>
            )}

            {/* DRAWER */}
            <Drawer
                open={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                width="70vw"
                destroyOnClose
                title={
                    selectedItem && (
                        <Space>
                            <UnorderedListOutlined />
                            {getFieldText(selectedItem?.cr4name)}
                        </Space>
                    )
                }
            >
                {selectedItem && (
                    <Row gutter={16}>
                        {/* =========================
               LEFT: ITEM ДЭЛГЭРЭНГҮЙ
            ========================= */}
                        <Col span={8}>
                            <Card
                                size="small"
                                title="Item дэлгэрэнгүй"
                                style={{ height: "100%" }}
                            >
                                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                                    <div>
                                        <Text type="secondary">Нэр</Text>
                                        <div>{getFieldText(selectedItem.cr4name)}</div>
                                    </div>

                                    <div>
                                        <Text type="secondary">Марк</Text>
                                        <div>{getFieldText(selectedItem.crmarkname)}</div>
                                    </div>

                                    <div>
                                        <Text type="secondary">ААН</Text>
                                        <div>{getFieldText(selectedItem.dname)}</div>
                                    </div>

                                    <div>
                                        <Text type="secondary">Код</Text>
                                        <div>{getFieldText(selectedItem.code)}</div>
                                    </div>

                                    <Divider />

                                    <div>
                                        <Text type="secondary">Тоо хэмжээ</Text>
                                        <div>{unwrapNumber(selectedItem.qty).toLocaleString()}</div>
                                    </div>

                                    <div>
                                        <Text type="secondary">Нийт үнэ</Text>
                                        <div>
                                            {unwrapNumber(selectedItem.pricesum).toLocaleString()} ₮
                                        </div>
                                    </div>

                                    {/* <div>
                                        <Text type="secondary">Нэмсэн огноо</Text>
                                        <div>{formatDate(selectedItem.added_at)}</div>
                                    </div> */}

                                    {/* {getFieldText(selectedItem.tailbar) && (
                                        <div>
                                            <Text type="secondary">Тайлбар</Text>
                                            <div>{getFieldText(selectedItem.tailbar)}</div>
                                        </div>
                                    )} */}
                                </Space>
                            </Card>
                        </Col>

                        {/* =========================
               RIGHT: STEPS + TIMELINE
            ========================= */}
                        <Col span={16}>
                            {stepsLoading ? (
                                <Spin />
                            ) : itemSteps.length === 0 ? (
                                <Empty description="Явцын мэдээлэл алга" />
                            ) : (
                                <>
                                    <Steps
                                        current={currentStepIndex}
                                        items={stepData.map((s) => ({
                                            title: s.title,
                                            icon: s.icon,
                                        }))}
                                    />

                                    <Divider />

                                    <Timeline
                                        items={itemSteps.map((s) => ({
                                            color: s.is_current ? "red" : "gray",
                                            dot: s.is_current ? <ClockCircleOutlined /> : null,
                                            children: (
                                                <div>
                                                    <Text strong={s.is_current}>{s.title}</Text>
                                                    {s.date?.Valid && (
                                                        <div style={{ fontSize: 12, color: "#888" }}>
                                                            {formatDateTime(s.date)}
                                                        </div>
                                                    )}
                                                    {s.is_current && (
                                                        <Tag color="red" style={{ marginTop: 4 }}>
                                                            Одоогийн шат
                                                        </Tag>
                                                    )}
                                                </div>
                                            ),
                                        }))}
                                    />
                                </>
                            )}
                        </Col>
                    </Row>
                )}
            </Drawer>

        </Card>
    );
};

export default Явц2;
