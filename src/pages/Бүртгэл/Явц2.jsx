import { useEffect, useMemo, useState } from "react";
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
    Segmented,
    Select,
    Button,
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
import { useSearchParams } from "react-router-dom";
import "./Явц2.css";

const { Title, Text } = Typography;
const { Search } = Input;
const API_BASE_URL = import.meta.env.VITE_API_URL;
const PAGE_SIZE = 10;

const stepData = [
    { key: "request", title: "Захиалга ирсэн", color: "blue", accent: "#1677ff", icon: <ShoppingCartOutlined /> },
    { key: "tender", title: "Тендерийн шат", color: "orange", accent: "#d97706", icon: <SolutionOutlined /> },
    { key: "contract", title: "Гэрээ байгуулах", color: "purple", accent: "#7c3aed", icon: <FileDoneOutlined /> },
    { key: "delivery", title: "Бараа хүлээн авалт", color: "green", accent: "#059669", icon: <CheckOutlined /> },
];

const backendToUiStep = {
    created_by_company: "request",
    sent_to_department: "request",
    department_to_nh: "request",
    nh_assigned: "request",
    planned_by_specialist: "request",
    tender_started: "tender",
    contract_signed: "contract",
    delivered: "delivery",
};

const getValue = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value !== "object") return value;
    if (value.Valid === false) return "";
    if (Object.prototype.hasOwnProperty.call(value, "String")) return value.String || "";
    if (Object.prototype.hasOwnProperty.call(value, "Int64")) return value.Int64 ?? "";
    if (Object.prototype.hasOwnProperty.call(value, "Float64")) return value.Float64 ?? "";
    return "";
};

const getText = (value) => String(getValue(value) ?? "").trim();
const getNumber = (value) => Number(getValue(value)) || 0;

const getTotal = (item) => {
    const total = getNumber(item.pricesum);
    return total > 0 ? total : getNumber(item.qty) * getNumber(item.price);
};

const formatDate = (value, withTime = false) => {
    const raw = getText(value);
    if (!raw) return "—";
    const parsed = dayjs(raw);
    if (parsed.isValid() && parsed.year() === 1900) return "Эхлэх хугацаа болоогүй";
    return parsed.isValid() ? parsed.format(withTime ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD") : raw;
};

const formatCode = (value) => {
    const raw = getText(value);
    const code = raw.replace(/\D/g, "");
    if (code.length !== 14) return raw || "—";
    return `${code.slice(0, 2)}-${code.slice(2, 4)}-${code.slice(4, 6)}-${code.slice(6, 8)}-${code.slice(8, 11)}-${code.slice(11)}`;
};

const matchSearch = (item, query) => {
    const normalizedQuery = query.toLocaleLowerCase("mn-MN").replace(/\s+/g, " ").trim();
    if (!normalizedQuery) return true;

    const searchableText = [
        item.cr4name,
        item.crmarkname,
        item.dname,
        item.mdocno,
        item.usize,
        item.code,
        item.pkgno,
        item.pkgname,
        item.pkgdate,
    ].map(getText).join(" ").toLocaleLowerCase("mn-MN");

    return normalizedQuery.split(" ").every((token) => searchableText.includes(token));
};

const getStageIndex = (item) => {
    const uiKey = backendToUiStep[getText(item.current_step_key)] || "request";
    const index = stepData.findIndex((step) => step.key === uiKey);
    return index >= 0 ? index : 0;
};

const getItemYear = (item) => {
    const raw = getText(item.pkgdate) || getText(item.added_at);
    const year = raw.match(/\d{4}/)?.[0] || "";
    return year === "1900" ? "" : year;
};

const isOverdue = (item) => {
    const raw = getText(item.deathdate);
    if (!raw || getStageIndex(item) === stepData.length - 1) return false;
    const date = dayjs(raw);
    return date.isValid() && date.year() !== 1900 && date.endOf("day").isBefore(dayjs());
};

const Явц2 = () => {
    const [searchParams] = useSearchParams();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [stageFilter, setStageFilter] = useState("all");
    const [yearFilter, setYearFilter] = useState("all");
    const [departmentFilter, setDepartmentFilter] = useState("all");
    const [sortOrder, setSortOrder] = useState("newest");
    const [page, setPage] = useState(1);
    const [selectedItem, setSelectedItem] = useState(null);
    const [itemSteps, setItemSteps] = useState([]);
    const [stepsLoading, setStepsLoading] = useState(false);

    useEffect(() => {
        const fetchItems = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${API_BASE_URL}/get/GetBasketItems`);
                setItems(Array.isArray(response.data) ? response.data : []);
            } catch (error) {
                console.error("GetBasketItems failed:", error);
                message.error("Өгөгдөл татаж чадсангүй");
            } finally {
                setLoading(false);
            }
        };
        fetchItems();
    }, []);

    useEffect(() => {
        const requestedItemId = Number(searchParams.get("itemId"));
        if (!requestedItemId || items.length === 0) return;
        const requestedItem = items.find((item) => Number(item.basket_item_id) === requestedItemId);
        if (requestedItem) setSelectedItem(requestedItem);
    }, [items, searchParams]);

    const years = useMemo(
        () => [...new Set(items.map(getItemYear).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
        [items]
    );

    const departments = useMemo(
        () => [...new Set(items.map((item) => getText(item.dname)).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, "mn")),
        [items]
    );

    const stageCounts = useMemo(() => {
        const counts = Object.fromEntries(stepData.map((step) => [step.key, 0]));
        items.forEach((item) => { counts[stepData[getStageIndex(item)].key] += 1; });
        return counts;
    }, [items]);

    const filteredItems = useMemo(() => {
        const result = items.filter((item) => {
            const stageKey = stepData[getStageIndex(item)].key;
            return (stageFilter === "all" || stageFilter === stageKey)
                && (yearFilter === "all" || yearFilter === getItemYear(item))
                && (departmentFilter === "all" || departmentFilter === getText(item.dname))
                && matchSearch(item, searchText);
        });

        return result.sort((left, right) => {
            if (sortOrder === "amount-desc") return getTotal(right) - getTotal(left);
            if (sortOrder === "amount-asc") return getTotal(left) - getTotal(right);
            if (sortOrder === "stage-desc") return getStageIndex(right) - getStageIndex(left);

            const leftDate = dayjs(getText(left.pkgdate));
            const rightDate = dayjs(getText(right.pkgdate));
            const leftTime = leftDate.isValid() ? leftDate.valueOf() : 0;
            const rightTime = rightDate.isValid() ? rightDate.valueOf() : 0;
            return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
        });
    }, [items, searchText, stageFilter, yearFilter, departmentFilter, sortOrder]);

    useEffect(() => setPage(1), [searchText, stageFilter, yearFilter, departmentFilter, sortOrder]);

    const pagedItems = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredItems.slice(start, start + PAGE_SIZE);
    }, [filteredItems, page]);

    useEffect(() => {
        if (!selectedItem?.basket_item_id) {
            setItemSteps([]);
            return undefined;
        }

        let active = true;
        const fetchSteps = async () => {
            try {
                setStepsLoading(true);
                const response = await axios.get(
                    `${API_BASE_URL}/get/GetItemSteps/${selectedItem.basket_item_id}`
                );
                if (active) setItemSteps(Array.isArray(response.data) ? response.data : []);
            } catch (error) {
                console.error("GetItemSteps failed:", error);
                if (active) {
                    setItemSteps([]);
                    message.error("Явцын мэдээлэл татаж чадсангүй");
                }
            } finally {
                if (active) setStepsLoading(false);
            }
        };

        fetchSteps();
        return () => { active = false; };
    }, [selectedItem]);

    const currentStepIndex = useMemo(() => {
        const current = itemSteps.find((step) => step.is_current);
        if (!current) return selectedItem ? getStageIndex(selectedItem) : 0;
        const uiKey = backendToUiStep[current.step_key] || "request";
        const index = stepData.findIndex((step) => step.key === uiKey);
        return index >= 0 ? index : 0;
    }, [itemSteps, selectedItem]);

    return (
        <Card bordered={false} className="order-progress-page">
            <div className="order-progress-header">
                <div>
                    <Title level={4}>Бараа материалын захиалгаар хайх</Title>
                    <Text type="secondary">Захиалга бүрийн одоогийн явц болон дэлгэрэнгүй түүх</Text>
                </div>
                <Tag color="blue">{filteredItems.length} захиалга</Tag>
            </div>
            <Divider style={{ margin: "16px 0" }} />

            <Space direction="vertical" size={10} className="order-progress-filters">
                <Segmented
                    value={stageFilter}
                    onChange={setStageFilter}
                    options={[
                        { label: `Бүгд (${items.length})`, value: "all" },
                        ...stepData.map((step) => ({
                            label: `${step.title} (${stageCounts[step.key]})`,
                            value: step.key,
                        })),
                    ]}
                />
                <Space wrap>
                    <Search
                        value={searchText}
                        placeholder="Нэр, марк, алба, огноо, кодоор хайх"
                        allowClear
                        style={{ width: 420, maxWidth: "100%" }}
                        onChange={(event) => setSearchText(event.target.value)}
                    />
                    <Select
                        value={yearFilter}
                        onChange={setYearFilter}
                        style={{ width: 120 }}
                        options={[
                            { label: "Бүх он", value: "all" },
                            ...years.map((year) => ({ label: `${year} он`, value: year })),
                        ]}
                    />
                    <Select
                        showSearch
                        optionFilterProp="label"
                        value={departmentFilter}
                        onChange={setDepartmentFilter}
                        style={{ width: 180 }}
                        options={[
                            { label: "Бүх алба", value: "all" },
                            ...departments.map((department) => ({ label: department, value: department })),
                        ]}
                    />
                    <Select
                        value={sortOrder}
                        onChange={setSortOrder}
                        style={{ width: 170 }}
                        options={[
                            { label: "Шинэ эхэнд", value: "newest" },
                            { label: "Хуучин эхэнд", value: "oldest" },
                            { label: "Дүн ихээс бага", value: "amount-desc" },
                            { label: "Дүн багаас их", value: "amount-asc" },
                            { label: "Явцын шатаар", value: "stage-desc" },
                        ]}
                    />
                    {(searchText || stageFilter !== "all" || yearFilter !== "all" || departmentFilter !== "all" || sortOrder !== "newest") && (
                        <Button
                            type="link"
                            onClick={() => {
                                setSearchText("");
                                setStageFilter("all");
                                setYearFilter("all");
                                setDepartmentFilter("all");
                                setSortOrder("newest");
                            }}
                        >
                            Цэвэрлэх
                        </Button>
                    )}
                </Space>
            </Space>

            {loading ? (
                <Spin />
            ) : pagedItems.length === 0 ? (
                <Empty description="Өгөгдөл олдсонгүй" />
            ) : (
                <>
                    <List
                        dataSource={pagedItems}
                        rowKey={(item) => item.basket_item_id}
                        renderItem={(item) => {
                        const stageIndex = getStageIndex(item);
                        const stage = stepData[stageIndex];
                        const overdue = isOverdue(item);
                            return (
                                <List.Item
                                    className="order-progress-row"
                                    style={{ "--stage-color": stage.accent }}
                                    onClick={() => setSelectedItem(item)}
                                >
                                    <Row gutter={12} style={{ width: "100%" }} align="middle">
                                        <Col xs={24} md={8}>
                                            <div className="order-progress-name-row">
                                                <span className="order-progress-stage-icon">{stage.icon}</span>
                                                <div>
                                                    <Text strong>{getText(item.cr4name) || "Нэргүй захиалга"}</Text>
                                                    <Text type="secondary">{getText(item.crmarkname) || "Маркгүй"}</Text>
                                                </div>
                                            </div>
                                            <Space size={[4, 4]} wrap className="order-progress-meta">
                                                <Tag>{getText(item.dname) || "Алба тодорхойгүй"}</Tag>
                                                <Tag>{formatCode(item.code)}</Tag>
                                                {getText(item.pkgname) && <Tag color="geekblue">{getText(item.pkgname)}</Tag>}
                                            </Space>
                                        </Col>

                                        <Col xs={24} md={10}>
                                            <div className="order-progress-status">
                                                <Space size={5}>
                                                    <Tag color={stage.color}>{stage.title}</Tag>
                                                    {overdue && <Tag color="red">Хугацаа хэтэрсэн</Tag>}
                                                </Space>
                                                <Text type={overdue ? "danger" : "secondary"}>
                                                    {overdue ? `Шаардагдах: ${formatDate(item.deathdate)}` : formatDate(item.pkgdate)}
                                                </Text>
                                            </div>
                                            <Progress
                                                percent={Math.round(((stageIndex + 1) / stepData.length) * 100)}
                                                size="small"
                                                strokeColor={stage.accent}
                                            />
                                        </Col>

                                        <Col xs={24} md={6} style={{ textAlign: "right" }}>
                                            <div className="order-progress-amount">
                                                <Text type="secondary">Нийт дүн</Text>
                                                <Text strong>{getTotal(item).toLocaleString()} ₮</Text>
                                                <span>
                                                    {getNumber(item.qty).toLocaleString()} {getText(item.mname) || getText(item.usize) || "нэгж"}
                                                </span>
                                            </div>
                                        </Col>
                                    </Row>
                                </List.Item>
                            );
                        }}
                    />

                    <Divider />
                    <div className="order-progress-pagination">
                        <Pagination
                            current={page}
                            pageSize={PAGE_SIZE}
                            total={filteredItems.length}
                            onChange={setPage}
                            showSizeChanger={false}
                            showTotal={(total) => `Нийт ${total} захиалга`}
                        />
                    </div>
                </>
            )}

            <Drawer
                open={Boolean(selectedItem)}
                onClose={() => setSelectedItem(null)}
                width="min(900px, calc(100vw - 12px))"
                destroyOnHidden
                title={selectedItem && (
                    <Space>
                        <UnorderedListOutlined />
                        {getText(selectedItem.cr4name)}
                    </Space>
                )}
            >
                {selectedItem && (
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={8}>
                            <Card size="small" title="Захиалгын дэлгэрэнгүй" style={{ height: "100%" }}>
                                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                                    <div><Text type="secondary">Нэр</Text><div>{getText(selectedItem.cr4name) || "—"}</div></div>
                                    <div><Text type="secondary">Марк</Text><div>{getText(selectedItem.crmarkname) || "—"}</div></div>
                                    <div><Text type="secondary">Алба</Text><div>{getText(selectedItem.dname) || "—"}</div></div>
                                    <div><Text type="secondary">Код</Text><div>{formatCode(selectedItem.code)}</div></div>
                                    <Divider style={{ margin: "8px 0" }} />
                                    <div><Text type="secondary">Тоо хэмжээ</Text><div>{getNumber(selectedItem.qty).toLocaleString()}</div></div>
                                    <div><Text type="secondary">Нэгж үнэ</Text><div>{getNumber(selectedItem.price).toLocaleString()} ₮</div></div>
                                    <div><Text type="secondary">Нийт үнэ</Text><div>{getTotal(selectedItem).toLocaleString()} ₮</div></div>
                                </Space>
                            </Card>
                        </Col>

                        <Col xs={24} lg={16}>
                            {stepsLoading ? (
                                <Spin />
                            ) : itemSteps.length === 0 ? (
                                <Empty description="Явцын мэдээлэл алга" />
                            ) : (
                                <>
                                    <Steps
                                        current={currentStepIndex}
                                        responsive
                                        items={stepData.map((step) => ({ title: step.title, icon: step.icon }))}
                                    />
                                    <Divider style={{ margin: "14px 0 10px" }} />
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <Text strong>Үйл явдлын түүх</Text>
                                        <Tag style={{ marginInlineEnd: 0 }}>{itemSteps.length}</Tag>
                                    </div>
                                    <Timeline
                                        items={itemSteps.map((step) => ({
                                            color: step.is_current ? "blue" : "gray",
                                            dot: step.is_current ? <ClockCircleOutlined /> : undefined,
                                            children: (
                                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                                    <span>
                                                        <Text strong={step.is_current}>{step.title}</Text>
                                                        {step.is_current && <Tag color="blue" style={{ marginLeft: 8 }}>Одоогийн шат</Tag>}
                                                    </span>
                                                    <Text type="secondary" style={{ fontSize: 12 }}>{formatDate(step.date, true)}</Text>
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
