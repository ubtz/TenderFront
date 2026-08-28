// Явц.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    Card,
    Steps,
    Typography,
    Tag,
    Table,
    Spin,
    message,
    Divider,
    Space,
    Row,
    Col,
    Progress,
    Badge,
    List,
    Button,
    Input,
    Select,
    Empty,
} from "antd";
import { useLocation } from "react-router-dom";

import {
    ShoppingCartOutlined,
    FileDoneOutlined,
    SolutionOutlined,
    CheckCircleTwoTone,
    CheckOutlined,
    UnorderedListOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { groupBy } from "lodash";
import { Drawer } from "antd";
import dayjs from "dayjs";
import "./Явц1.css";

const { Title, Text } = Typography;
const { Search } = Input;

// Алхамын өгөгдөл
const stepData = [
    {
        key: "request",
        title: "Захиалга ирсэн",
        actor: "Салбар нэгж",
        description: "Салбар нэгж захиалга үүсгэж өөрийн харьяа албанд илгээх.",
        status: "finish",
        icon: <ShoppingCartOutlined />,
    },
    {
        key: "tender",
        title: "Тендерийн шат",
        actor: "Үнэлгээний хороо",
        description: "ТББ боловсруулах, тендер зарлах, нээлт хийж үнэлгээ гүйцэтгэх.",
        status: "wait",
        icon: <SolutionOutlined />,
    },
    {
        key: "contract",
        title: "Гэрээ байгуулах",
        actor: "Захиалагч / ААН",
        description: "Сонгогдсон нийлүүлэгчтэй гэрээ байгуулах, баталгаажуулах.",
        status: "wait",
        icon: <CheckCircleTwoTone twoToneColor="#faad14" />,
    },
    {
        key: "done",
        title: "Бараа хүлээн авалт",
        actor: "Захиалагч",
        description: "Бараа, материал хүлээн авч, гэрээг дуусгавар болгох.",
        status: "wait",
        icon: <CheckOutlined />,
    },
];

const mapStatusToAnt = (s) => {
    if (s === "finish") return "finish";
    if (s === "process") return "process";
    return "wait";
};

// helper: handle {String, Valid} эсвэл шууд string/number
const getFieldText = (v) => {
    if (v && typeof v === "object" && "String" in v) {
        return v.String || "";
    }
    return v ?? "";
};

// Date formatter: "2025-10-21T16:14:01.163Z" → "2025-10-21"
const formatDate = (value) => {
    const raw = getFieldText(value);
    if (!raw) return "—";
    const parsed = dayjs(raw);
    if (parsed.isValid() && parsed.year() === 1900) return "Эхлэх хугацаа болоогүй";
    return parsed.isValid() ? parsed.format("YYYY-MM-DD") : String(raw).split("T")[0];
};

// Numeric un-wrapper (sql.NullFloat64, NullInt64, etc)
const unwrapNumber = (v) => {
    if (!v) return 0;

    // sql.NullFloat64 / NullInt64
    if (typeof v === "object" && v.Valid) {
        if (typeof v.Float64 === "number") return v.Float64;
        if (typeof v.Int64 === "number") return v.Int64;
        if (typeof v.String === "string") return Number(v.String) || 0;
    }

    const n = Number(v);
    return isNaN(n) ? 0 : n;
};

const getItemTotal = (item) => {
    const total = unwrapNumber(item.pricesum);
    const price = unwrapNumber(item.price || item.Price);
    return total > 0 ? total : unwrapNumber(item.qty) * price;
};

const formatCode = (value) => {
    const raw = String(getFieldText(value) || "").trim();
    const code = raw.replace(/\D/g, "");
    if (code.length !== 14) return raw || "—";
    return `${code.slice(0, 2)}-${code.slice(2, 4)}-${code.slice(4, 6)}-${code.slice(6, 8)}-${code.slice(8, 11)}-${code.slice(11)}`;
};
const getUiStepKeyFromRow = (row) => {
    const backendKey =
        row.current_step_key ||
        row.currentStepKey ||
        getFieldText(row.current_step_key);

    return BACKEND_TO_UI_STEP[backendKey] || "request";
};
const BACKEND_TO_UI_STEP = {
    created_by_company: "request",
    sent_to_department: "request",
    department_to_nh: "request",
    nh_assigned: "request",
    planned_by_specialist: "request",

    tender_started: "tender",
    contract_signed: "contract",
    delivered: "done",
};

const stepTagColor = (stepKey) => {
    switch (stepKey) {
        case "request":
            return "blue";
        case "collect":
            return "geekblue";
        case "tender":
            return "orange";
        case "contract":
            return "purple";
        case "done":
            return "green";
        default:
            return "default";
    }
};

const StepPalette = stepData.map((s, i) => ({
    key: s.key,
    title: s.title,
    color: stepTagColor(s.key),
    index: i,
}));

const Явц = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const currentStep = stepData[currentIndex];
    const location = useLocation();

    const [items, setItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [selectedBundle, setSelectedBundle] = useState(null);
    const [activeStepKey, setActiveStepKey] = useState(null);
    const [searchText, setSearchText] = useState("");
    const [yearFilter, setYearFilter] = useState("all");
    const [departmentFilter, setDepartmentFilter] = useState("all");
    const [sortOrder, setSortOrder] = useState("newest");
    // null = бүх багц
    const API_BASE_URL = import.meta.env.VITE_API_URL;
    // fetch
    useEffect(() => {
        const incomingStepKey = location.state?.activeStepKey;

        if (incomingStepKey) {
            const idx = stepData.findIndex((s) => s.key === incomingStepKey);
            if (idx >= 0) {
                setActiveStepKey(incomingStepKey);
                setCurrentIndex(idx);
            }
        }
    }, [location.state]);

    useEffect(() => {
        const fetchItems = async () => {
            try {
                setLoadingItems(true);
                const res = await axios.get(
                    `${API_BASE_URL}/get/GetBasketItems`
                );
                setItems(res.data || []);
            } catch (err) {
                console.error("❌ GetBasketItems error:", err);
                message.error("Сагсны өгөгдөл татаж чадсангүй.");
            } finally {
                setLoadingItems(false);
            }
        };

        fetchItems();
    }, []);

    // БАГЦААР НЭГТГЭХ (pkgno + pkgdate)
    const bundles = useMemo(() => {
        if (!items?.length) return [];

        const grouped = groupBy(items, (item) => {
            const pkgno =
                getFieldText(item.pkgno || item.PkgNo || item.pkgNo) || "—";
            const pkgdate =
                getFieldText(item.pkgdate || item.PkgDate || item.pkgDate) || "—";
            return `${pkgno}___${pkgdate}`;
        });

        const stepKeys = stepData.map((s) => s.key);

        return Object.entries(grouped).map(([key, rows], index) => {
            const [pkgno, pkgdate] = key.split("___");

            // багцын алхмыг тодорхойлох – хамгийн өндөр шат
            const stepIndex = rows.reduce((max, row) => {
                const uiKey = getUiStepKeyFromRow(row);
                const idx = stepData.findIndex((s) => s.key === uiKey);
                return idx > max ? idx : max;
            }, 0);


            const totalQty = rows.reduce((sum, r) => sum + unwrapNumber(r.qty), 0);
            const totalPrice = rows.reduce((sum, row) => sum + getItemTotal(row), 0);

            const departments = [...new Set(rows.map((row) => String(getFieldText(row.dname) || "").trim()).filter(Boolean))];
            const pkgname = String(getFieldText(rows[0]?.pkgname) || "").trim();
            const validRequiredDates = rows
                .map((row) => dayjs(getFieldText(row.deathdate)))
                .filter((date) => date.isValid() && date.year() !== 1900);
            const requiredDate = validRequiredDates.sort((a, b) => a.valueOf() - b.valueOf())[0] || null;
            const isOverdue = stepIndex < stepData.length - 1
                && requiredDate
                && requiredDate.endOf("day").isBefore(dayjs());

            const preparedItems = rows.map((row, idx2) => ({
                ...row,
                key: row.basket_item_id || row.BasketItemId || `${pkgno}_${pkgdate}_${idx2}`,
            }));

            return {
                key: `${pkgno}_${pkgdate}_${index}`,
                pkgno,
                pkgname,
                pkgdate,
                departments,
                requiredDate,
                isOverdue,
                items: preparedItems,
                stepIndex,
                stepKey: stepData[stepIndex]?.key || "request",
                stepTitle: stepData[stepIndex]?.title,
                totalQty,
                totalPrice,
                itemCount: rows.length,
            };
        });
    }, [items]);

    // STATUS SUMMARY (counts per step)
    const statusSummary = useMemo(() => {
        const counts = {};
        StepPalette.forEach((s) => (counts[s.key] = 0));
        bundles.forEach((b) => {
            const k = b.stepKey || "request";
            counts[k] = (counts[k] || 0) + 1;
        });
        const total = bundles.length || 1;
        return {
            counts,
            total: bundles.length,
            percent: Object.fromEntries(
                Object.entries(counts).map(([k, v]) => [k, Math.round((v / total) * 100)])
            ),
        };
    }, [bundles]);
    const years = useMemo(() => [...new Set(bundles.map((bundle) => {
        const parsed = dayjs(bundle.pkgdate);
        return parsed.isValid() && parsed.year() !== 1900 ? String(parsed.year()) : "";
    }).filter(Boolean))].sort((a, b) => b.localeCompare(a)), [bundles]);

    const departments = useMemo(() => [...new Set(bundles.flatMap((bundle) => bundle.departments))]
        .sort((a, b) => a.localeCompare(b, "mn")), [bundles]);

    const filteredBundles = useMemo(() => {
        const query = searchText.toLocaleLowerCase("mn-MN").trim();
        const result = bundles.filter((bundle) => {
            const packageYear = dayjs(bundle.pkgdate).isValid() ? String(dayjs(bundle.pkgdate).year()) : "";
            const searchable = [
                bundle.pkgno,
                bundle.pkgname,
                ...bundle.departments,
                ...bundle.items.flatMap((item) => [item.cr4name, item.crmarkname, item.code]),
            ].map((value) => String(getFieldText(value) || "")).join(" ").toLocaleLowerCase("mn-MN");

            return (!activeStepKey || bundle.stepKey === activeStepKey)
                && (yearFilter === "all" || packageYear === yearFilter)
                && (departmentFilter === "all" || bundle.departments.includes(departmentFilter))
                && (!query || query.split(/\s+/).every((token) => searchable.includes(token)));
        });

        return result.sort((left, right) => {
            if (sortOrder === "amount-desc") return right.totalPrice - left.totalPrice;
            if (sortOrder === "amount-asc") return left.totalPrice - right.totalPrice;
            if (sortOrder === "stage-desc") return right.stepIndex - left.stepIndex;
            if (sortOrder === "overdue") return Number(right.isOverdue) - Number(left.isOverdue);
            const leftTime = dayjs(left.pkgdate).isValid() ? dayjs(left.pkgdate).valueOf() : 0;
            const rightTime = dayjs(right.pkgdate).isValid() ? dayjs(right.pkgdate).valueOf() : 0;
            return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
        });
    }, [bundles, activeStepKey, searchText, yearFilter, departmentFilter, sortOrder]);

    // item columns (for expanded table)
    const itemColumns = [
        {
            title: "№",
            key: "index",
            width: 60,
            align: "center",
            render: (_, __, index) => index + 1,
        },
        {
            title: "Код",
            dataIndex: "code",
            key: "code",
            width: 145,
            render: formatCode,
        },
        {
            title: "Нэр",
            dataIndex: "cr4name",
            key: "cr4name",
            render: (v, record) => getFieldText(v) || getFieldText(record.name) || "",
        },
        {
            title: "Хаанаас",
            dataIndex: "dname",
            key: "dname",
            render: (v) => getFieldText(v),
        },
        {
            title: "Хэмжих нэгж",
            dataIndex: "usize",
            key: "usize",
            align: "center",
            render: (v, record) => getFieldText(v) || getFieldText(record.unit) || "",
        },
        {
            title: "Тоо хэмжээ",
            dataIndex: "qty",
            key: "qty",
            align: "right",
            render: (v) => {
                const n = unwrapNumber(v);
                return n.toLocaleString();
            },
        },
        {
            title: "Үнэ",
            dataIndex: "price",
            key: "price",
            align: "right",
            render: (v, record) => {
                const n = unwrapNumber(v || record.Price);
                return n.toLocaleString() + " ₮";
            },
        },

        {
            title: "Нийт үнэ",
            dataIndex: "pricesum",
            key: "pricesum",
            align: "right",
            render: (v, record) => {
                // fallback: qty * Price
                return getItemTotal(record).toLocaleString() + " ₮";
            },
        },
        {
            title: "Нэмсэн огноо",
            dataIndex: "added_at",
            key: "added_at",
            render: (v, record) => formatDate(v) || formatDate(record?.AddedAt),
        },
    ];
    const totalBundles = bundles.length;
    const totalItems = items.length;
    const grandTotalPrice = bundles.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    // new: render bundle as vertical list item
    const renderBundleListItem = (b, idx) => {
        const progressPercent = Math.round(
            ((Math.max(b.stepIndex, 0) + 1) / stepData.length) * 100
        );

        return (
            <List.Item
                key={b.key}
                className={b.isOverdue ? "plan-progress-row is-overdue" : "plan-progress-row"}
                style={{
                    cursor: "pointer",
                    padding: 12,
                    borderRadius: 8,
                    background: selectedBundle && selectedBundle.key === b.key ? "#f0f7ff" : "#ffffff",
                    boxShadow: selectedBundle && selectedBundle.key === b.key ? "0 6px 20px rgba(16,24,40,0.06)" : "0 2px 6px rgba(2,6,23,0.03)",
                    marginBottom: 8,
                }}
            >
                <Row style={{ width: "100%" }} align="middle" gutter={[12, 12]}>
                    <Col flex="180px">
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <Text strong style={{ fontSize: 15 }}>
                                Багц #{b.pkgno}
                            </Text>
                            {b.pkgname && (
                                <Text ellipsis={{ tooltip: b.pkgname }} style={{ maxWidth: 220, fontSize: 12 }}>
                                    {b.pkgname}
                                </Text>
                            )}
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {formatDate(b.pkgdate)}
                            </Text>
                        </div>
                    </Col>

                    <Col flex="1 1 320px">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                            <div style={{ minWidth: 160 }}>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <div style={{ width: 8, height: 8, borderRadius: 4, background: stepTagColor(b.stepKey) }} />
                                    <Text>{b.stepTitle}</Text>
                                    {b.isOverdue && <Tag color="red">Хугацаа хэтэрсэн</Tag>}
                                </div>
                                {b.requiredDate && (
                                    <Text type={b.isOverdue ? "danger" : "secondary"} style={{ fontSize: 11 }}>
                                        Шаардагдах: {formatDate(b.requiredDate)}
                                    </Text>
                                )}
                                <div style={{ marginTop: 8 }}>
                                    <Progress percent={progressPercent} size="small" showInfo={false} />
                                </div>
                            </div>

                            <div style={{ textAlign: "right" }}>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        Нийт:{" "}
                                    </Text>
                                    <div style={{ fontWeight: 700 }}>{b.totalPrice.toLocaleString()} ₮</div>
                                </div>
                            </div>
                        </div>
                    </Col>

                    <Col flex="220px" style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            <Tag>{b.itemCount} нэр</Tag>
                            <Tag>{b.totalQty.toLocaleString()} ширхэг</Tag>
                        </div>

                        <div style={{ marginTop: 8 }}>
                            <Space>
                                <Button
                                    size="small"
                                    type="primary"
                                    onClick={() => {
                                        setSelectedBundle(b);
                                        setCurrentIndex(b.stepIndex ?? 0);
                                    }}
                                >
                                    Дэлгэрэнгүй
                                </Button>

                            </Space>
                        </div>
                    </Col>
                </Row>
            </List.Item>
        );
    };

    return (
        <Card
            bordered={false}
            style={{
                borderRadius: 16,
                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                padding: 0,
                background: "radial-gradient(circle at 0 0, #eff6ff 0, #ffffff 45%)",
            }}
        >
            <div
                style={{
                    padding: "16px 20px 8px",
                    borderBottom: "1px solid #eef2ff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                }}
            >
                <div>
                    <Title level={4} style={{ margin: 0, marginBottom: 4 }}>
                        Aжлын явц
                    </Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Багц үүсэлтээс эхлээд бараа хүлээн авах хүртэлх шатлалын хяналт
                    </Text>
                </div>

                <Space size="large" wrap>
                    <div style={{ textAlign: "right" }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            Багцын тоо
                        </Text>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>{totalBundles.toLocaleString()}</div>
                    </div>
                    <Divider type="vertical" style={{ height: 40 }} />
                    <div style={{ textAlign: "right" }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            Нийт барааны төрөл
                        </Text>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>{totalItems.toLocaleString()}</div>
                    </div>
                    <Divider type="vertical" style={{ height: 40 }} />
                    <div style={{ textAlign: "right" }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            Нийт төсөв
                        </Text>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>{grandTotalPrice.toLocaleString()} ₮</div>
                    </div>
                </Space>
            </div>

            <div style={{ padding: 16 }}>

                {/* delivery status steps */}
                <Card
                    size="small"
                    bordered={false}
                    style={{
                        borderRadius: 12,
                        background: "#f9fafb",
                        marginBottom: 16,
                    }}
                    styles={{ body: { padding: 12 } }}
                >
                    <Steps
                        current={currentIndex}
                        onChange={(idx) => {
                            const stepKey = stepData[idx]?.key;

                            // toggle filter
                            if (activeStepKey === stepKey) {
                                setActiveStepKey(null);      // filter арилна
                                setCurrentIndex(0);          // blue line reset (эсвэл хүссэн index)
                            } else {
                                setActiveStepKey(stepKey);  // filter тавина
                                setCurrentIndex(idx);       // blue line яг тэр алхамд очно
                            }
                        }}
                        labelPlacement="vertical"
                        size="small"
                        items={stepData.map((s, i) => ({
                            title: s.title,
                            icon: s.icon,
                            status:
                                i < currentIndex
                                    ? "finish"
                                    : i === currentIndex
                                        ? "process"
                                        : "wait",
                        }))}
                    />

                    {/* Одоогийн шатны дэлгэрэнгүй */}
                    <Card
                        size="small"
                        style={{
                            marginTop: 12,
                            borderRadius: 10,
                            background: "#ffffff",
                            border: "1px solid #e5e7eb",
                        }}
                        styles={{ body: { padding: 12 } }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: 220 }}>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    Одоогийн шат
                                </Text>
                                <Title level={5} style={{ margin: "4px 0 2px" }}>
                                    {currentStep.title}
                                </Title>
                                <Text strong style={{ fontSize: 12 }}>
                                    {currentStep.actor}
                                </Text>
                                <div style={{ marginTop: 4 }}>
                                    <Text style={{ fontSize: 12 }}>{currentStep.description}</Text>
                                </div>
                            </div>

                            <div style={{ textAlign: "right", minWidth: 220 }}>
                                {selectedBundle ? (
                                    <>
                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                            Сонгосон багц
                                        </Text>
                                        <div style={{ marginTop: 4, marginBottom: 4 }}>
                                            <Tag color="blue">Багц #{selectedBundle.pkgno}</Tag>
                                            <Tag>{formatDate(selectedBundle.pkgdate) || selectedBundle.pkgdate}</Tag>
                                        </div>
                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                            Төлөв:
                                        </Text>{" "}
                                        <Tag color={stepTagColor(selectedBundle.stepKey)}>{selectedBundle.stepTitle || "Захиалга ирсэн"}</Tag>
                                    </>
                                ) : (
                                    <>

                                    </>
                                )}
                            </div>
                        </div>
                    </Card>
                </Card>

                {/* БАГЦЫН ХҮСНЭГТ -> VERTICAL LIST (1 item per row) */}
                <Card
                    size="small"
                    style={{ borderRadius: 12 }}
                    styles={{ body: { padding: 12 } }}
                    title={`Багцласан захиалгууд (${filteredBundles.length})`}
                >
                    <Space direction="vertical" size={10} className="plan-progress-filters">
                        <Space wrap>
                            <Search
                                allowClear
                                value={searchText}
                                onChange={(event) => setSearchText(event.target.value)}
                                placeholder="Багц, бараа, код, албаар хайх"
                                style={{ width: 340, maxWidth: "100%" }}
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
                                    { label: "Хугацаа хэтэрсэн", value: "overdue" },
                                ]}
                            />
                            {(searchText || yearFilter !== "all" || departmentFilter !== "all" || sortOrder !== "newest") && (
                                <Button
                                    type="link"
                                    onClick={() => {
                                        setSearchText("");
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
                    {loadingItems ? (
                        <div style={{ textAlign: "center", padding: "40px 0" }}>
                            <Spin tip="Ачаалж байна..." />
                        </div>
                    ) : (
                        <List
                            dataSource={filteredBundles}
                            locale={{ emptyText: <Empty description="Тохирох багц олдсонгүй" /> }}
                            renderItem={(b, idx) => renderBundleListItem(b, idx)}
                        />
                    )}
                </Card>
                {/* SELECTED BUNDLE DETAILS */}

                <Drawer
                    title={
                        selectedBundle ? (
                            <Space>
                                <UnorderedListOutlined />
                                <span>Багц #{selectedBundle.pkgno}</span>
                                <Tag color={stepTagColor(selectedBundle.stepKey)}>
                                    {selectedBundle.stepTitle}
                                </Tag>
                            </Space>
                        ) : null
                    }
                    placement="right"
                    width="min(820px, calc(100vw - 12px))"
                    open={!!selectedBundle}
                    onClose={() => setSelectedBundle(null)}
                    destroyOnHidden
                >
                    {selectedBundle && (
                        <>
                            {/* SUMMARY */}
                            <Row gutter={[16, 12]} style={{ marginBottom: 16 }}>
                                <Col xs={24} sm={12}>
                                    <Text type="secondary">Багц огноо</Text>
                                    <div>{formatDate(selectedBundle.pkgdate)}</div>
                                </Col>

                                <Col xs={24} sm={12}>
                                    <Text type="secondary">Төрлийн тоо</Text>
                                    <div>{selectedBundle.itemCount} нэр</div>
                                </Col>

                                <Col xs={24} sm={12}>
                                    <Text type="secondary">Нийт тоо хэмжээ</Text>
                                    <div>{selectedBundle.totalQty.toLocaleString()}</div>
                                </Col>

                                <Col xs={24} sm={12}>
                                    <Text type="secondary">Нийт үнэ</Text>
                                    <div style={{ fontWeight: 600 }}>
                                        {selectedBundle.totalPrice.toLocaleString()} ₮
                                    </div>
                                </Col>
                            </Row>

                            <Divider />

                            {/* ITEMS TABLE */}
                            <Table
                                size="small"
                                rowKey="key"
                                columns={itemColumns}
                                dataSource={selectedBundle.items}
                                pagination={false}
                                bordered
                                scroll={{ x: 900 }}
                            />
                        </>
                    )}
                </Drawer>

            </div>
        </Card>
    );
};

export default Явц;
