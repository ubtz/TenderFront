import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Button,
    Card,
    Checkbox,
    Empty,
    Input,
    Modal,
    Space,
    Spin,
    Table,
    Tag,
    Typography,
    message,
} from "antd";
import {
    CalendarOutlined,
    FileAddOutlined,
    FolderOpenOutlined,
    LockOutlined,
    ProjectOutlined,
    ReloadOutlined,
    SearchOutlined,
} from "@ant-design/icons";
import axios from "axios";
import PrintIcon from "./PrintIcon";
import ТөлөвлөгөөItemDetails from "./ТөлөвлөгөөItemDetails";
import "./Төлөвлөгөө_table.css";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const { Text } = Typography;

const unwrap = (value) => {
    if (!value || typeof value !== "object") return value;
    for (const key of ["String", "Int64", "Float64", "Bool", "Time"]) {
        if (value[key] !== undefined && value[key] !== null) return value[key];
    }
    return "";
};
const normalize = (value) => String(unwrap(value) ?? "").trim();
const toNumber = (value) => Number(normalize(value).replace(/,/g, "")) || 0;
const itemTotal = (item) => toNumber(item.price) * toNumber(item.qty);
const formatNumber = (value) => toNumber(value).toLocaleString();
const formatDate = (value) => {
    const normalized = normalize(value);
    if (!normalized) return "-";
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? normalized : date.toLocaleDateString("mn-MN");
};
const getDateYear = (value) => normalize(value).match(/^(\d{4})/)?.[1] || "";

const ТөлөвлөгөөTable = () => {
    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("data") || "{}");
        } catch {
            return {};
        }
    }, []);
    const isManager = normalize(user?.erh || user?.Erh).toLocaleLowerCase() === "удирдлага";

    const [data, setData] = useState([]);
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [activeYear, setActiveYear] = useState("all");
    const [expandedPlanKeys, setExpandedPlanKeys] = useState([]);
    const [expandedBasketKeys, setExpandedBasketKeys] = useState([]);

    const [tenderModalOpen, setTenderModalOpen] = useState(false);
    const [tenderLoading, setTenderLoading] = useState(false);
    const [tenderOptionsLoading, setTenderOptionsLoading] = useState(false);
    const [currentPlan, setCurrentPlan] = useState(null);
    const [tenderNumber, setTenderNumber] = useState("");
    const [selectedBasketIds, setSelectedBasketIds] = useState([]);
    const [lockedBasketIds, setLockedBasketIds] = useState([]);
    const [basketTenderMap, setBasketTenderMap] = useState({});

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [plansResult, usersResult, branchesResult] = await Promise.allSettled([
                axios.get(`${API_BASE_URL}/get/GetAll`),
                axios.get(`${API_BASE_URL}/get/GetUsers`),
                axios.get(`${API_BASE_URL}/get/branches`),
            ]);
            if (plansResult.status === "rejected") throw plansResult.reason;
            if (usersResult.status === "fulfilled") setUsers(usersResult.value.data || []);
            if (branchesResult.status === "fulfilled") setBranches(branchesResult.value.data || []);

            const allPlans = plansResult.value.data || [];
            const permittedPlans = isManager
                ? allPlans
                : allPlans.filter((plan) => String(plan.user_id) === String(user.id));

            const transformed = permittedPlans
                .map((planGroup) => {
                    const baskets = (planGroup.baskets || [])
                        .filter((basket) => normalize(basket.basket_type).toUpperCase() !== "TEMP" && !basket.is_temp)
                        .map((basket) => {
                            const items = basket.items || [];
                            return {
                                key: `basket-${basket.basket_id}`,
                                basket_id: basket.basket_id,
                                basket_number: basket.basket_number,
                                basket_name: normalize(basket.basket_name) || "Нэргүй багц",
                                basket_type: normalize(basket.basket_type) || "Ангилалгүй",
                                plan_name: normalize(basket.plan_name),
                                set_date: basket.set_date,
                                publish_date: basket.publish_date,
                                total_price: items.reduce((sum, item) => sum + itemTotal(item), 0),
                                item_count: items.length,
                                items,
                                is_valid: Boolean(basket.is_valid),
                            };
                        });

                    return {
                        key: `plan-${planGroup.plan_root_number}`,
                        plan_root_number: planGroup.plan_root_number,
                        plan_name: normalize(planGroup.plan_name) || "Нэргүй төлөвлөгөө",
                        user_id: planGroup.user_id,
                        baskets,
                        total_price: baskets.reduce((sum, basket) => sum + basket.total_price, 0),
                        item_count: baskets.reduce((sum, basket) => sum + basket.item_count, 0),
                    };
                })
                .filter((plan) => plan.baskets.length > 0)
                .sort((first, second) => first.plan_name.localeCompare(second.plan_name));

            setData(transformed);
        } catch (error) {
            console.error("Plan data fetch failed:", error);
            message.error("Төлөвлөгөөний мэдээлэл татахад алдаа гарлаа");
        } finally {
            setLoading(false);
        }
    }, [isManager, user.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const userMap = useMemo(
        () => new Map(users.map((entry) => [String(entry.id ?? entry.user_id), entry])),
        [users]
    );
    const getUserName = useCallback((id) => {
        const entry = userMap.get(String(id));
        if (!entry) return "—";
        return [entry.ovog, entry.ner].filter(Boolean).join(" ").trim()
            || normalize(entry.username)
            || "—";
    }, [userMap]);

    const yearOptions = useMemo(
        () => [...new Set(
            data.flatMap((plan) =>
                plan.baskets.map((basket) => getDateYear(basket.publish_date) || getDateYear(basket.set_date))
            ).filter(Boolean)
        )].sort((first, second) => second.localeCompare(first)),
        [data]
    );

    const yearFilteredData = useMemo(() => {
        if (activeYear === "all") return data;
        return data.flatMap((plan) => {
            const baskets = plan.baskets.filter((basket) =>
                (getDateYear(basket.publish_date) || getDateYear(basket.set_date)) === activeYear
            );
            return baskets.length ? [{
                ...plan,
                baskets,
                total_price: baskets.reduce((sum, basket) => sum + basket.total_price, 0),
                item_count: baskets.reduce((sum, basket) => sum + basket.item_count, 0),
            }] : [];
        });
    }, [activeYear, data]);

    const filteredData = useMemo(() => {
        const query = searchText.trim().toLocaleLowerCase();
        if (!query) return yearFilteredData;

        return yearFilteredData.flatMap((plan) => {
            const planMatches = [plan.plan_name, plan.plan_root_number, getUserName(plan.user_id)]
                .some((value) => normalize(value).toLocaleLowerCase().includes(query));
            if (planMatches) return [plan];

            const baskets = plan.baskets.filter((basket) => {
                const basketMatches = [
                    basket.basket_name,
                    basket.basket_number,
                    basket.basket_type,
                    basket.set_date,
                ].some((value) => normalize(value).toLocaleLowerCase().includes(query));
                const itemMatches = basket.items.some((item) => [
                    item.pkgno,
                    item.cr4name,
                    item.crmarkname,
                    item.crbrandname,
                    item.zno,
                    item.dname,
                ].some((value) => normalize(value).toLocaleLowerCase().includes(query)));
                return basketMatches || itemMatches;
            });
            return baskets.length ? [{
                ...plan,
                baskets,
                total_price: baskets.reduce((sum, basket) => sum + basket.total_price, 0),
                item_count: baskets.reduce((sum, basket) => sum + basket.item_count, 0),
            }] : [];
        });
    }, [getUserName, searchText, yearFilteredData]);

    const summary = useMemo(() => ({
        planCount: filteredData.length,
        basketCount: filteredData.reduce((sum, plan) => sum + plan.baskets.length, 0),
        itemCount: filteredData.reduce((sum, plan) => sum + plan.item_count, 0),
        totalPrice: filteredData.reduce((sum, plan) => sum + plan.total_price, 0),
    }), [filteredData]);

    const openTenderModal = async (plan) => {
        setCurrentPlan(plan);
        setTenderNumber("");
        setSelectedBasketIds([]);
        setLockedBasketIds([]);
        setBasketTenderMap({});
        setTenderModalOpen(true);
        setTenderOptionsLoading(true);
        try {
            const response = await axios.get(
                `${API_BASE_URL}/get/GetBasketIdsByRootNum/${plan.plan_root_number}`
            );
            setLockedBasketIds((response.data?.basketIds || []).map(String));
            setBasketTenderMap(response.data?.basketTenderMap || {});
        } catch (error) {
            console.error("Tender basket locks fetch failed:", error);
            message.error("Тендерт орсон багцуудыг шалгахад алдаа гарлаа");
        } finally {
            setTenderOptionsLoading(false);
        }
    };

    const selectedTenderBaskets = useMemo(() => {
        const selected = new Set(selectedBasketIds.map(String));
        return (currentPlan?.baskets || []).filter((basket) => selected.has(String(basket.basket_id)));
    }, [currentPlan, selectedBasketIds]);
    const selectedTenderTotal = selectedTenderBaskets.reduce(
        (sum, basket) => sum + basket.total_price,
        0
    );

    const saveTender = async () => {
        const normalizedTenderNumber = tenderNumber.trim();
        if (!normalizedTenderNumber) {
            message.warning("Тендерийн дугаар оруулна уу");
            return;
        }
        if (!selectedTenderBaskets.length) {
            message.warning("Багц сонгоно уу");
            return;
        }
        if (selectedBasketIds.some((id) => lockedBasketIds.includes(String(id)))) {
            message.error("Сонгосон багцын зарим нь тендерт орсон байна");
            return;
        }

        const organization = [...new Set(
            selectedTenderBaskets.flatMap((basket) =>
                basket.items.map((item) => normalize(item.dname)).filter(Boolean)
            )
        )].join(", ");

        setTenderLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/post/PostTender`, {
                plan_root_number: currentPlan.plan_root_number,
                тендерийн_дугаар: normalizedTenderNumber,
                tender_name: currentPlan.plan_name,
                Organization: organization,
                Basket_Ids: selectedBasketIds.join(","),
                CreatedBy: user.id,
            });
            message.success("Тендер амжилттай үүсгэгдлээ");
            setTenderModalOpen(false);
            setCurrentPlan(null);
            setSelectedBasketIds([]);
            setTenderNumber("");
        } catch (error) {
            console.error("Tender creation failed:", error);
            message.error(error.response?.data?.message || "Тендер үүсгэхэд алдаа гарлаа");
        } finally {
            setTenderLoading(false);
        }
    };

    const basketColumns = [
        {
            title: "Ангилал",
            dataIndex: "basket_type",
            key: "basket_type",
            width: 150,
            render: (value) => <Tag bordered={false}>{value}</Tag>,
        },
        { title: "№", dataIndex: "basket_number", key: "basket_number", width: 70, align: "center" },
        {
            title: "Багцын нэр",
            dataIndex: "basket_name",
            key: "basket_name",
            width: 280,
            ellipsis: true,
            render: (value, record) => (
                <Space direction="vertical" size={3}>
                    <Space size={8}>
                        <FolderOpenOutlined
                            style={{
                                color: expandedBasketKeys.includes(record.key) ? "#4d829f" : "#8c8c8c",
                                fontSize: 16,
                            }}
                        />
                        <Text strong>Багц № {record.basket_number}: {value}</Text>
                    </Space>
                    <Text type="secondary">{record.item_count} захиалга</Text>
                </Space>
            ),
        },
        { title: "Зарлах огноо", dataIndex: "publish_date", key: "publish_date", width: 125, render: formatDate },
        { title: "Нээх огноо", dataIndex: "set_date", key: "set_date", width: 125, render: formatDate },
        {
            title: "Нийт үнэ",
            dataIndex: "total_price",
            key: "total_price",
            width: 155,
            align: "right",
            sorter: (first, second) => first.total_price - second.total_price,
            render: (value) => <Text strong>{formatNumber(value)} ₮</Text>,
        },
    ];

    const planColumns = [
        {
            title: "Төлөвлөгөө",
            dataIndex: "plan_name",
            key: "plan_name",
            ellipsis: true,
            sorter: (first, second) => first.plan_name.localeCompare(second.plan_name),
            render: (value, record) => (
                <Space direction="vertical" size={3}>
                    <Space size={9}>
                        <ProjectOutlined
                            style={{
                                color: expandedPlanKeys.includes(record.key) ? "#4d829f" : "#8c8c8c",
                                fontSize: 17,
                            }}
                        />
                        <Text strong style={{ fontSize: 15 }}>{value}</Text>
                    </Space>
                    <Space size={6} wrap>
                        <Tag bordered={false}>{record.baskets.length} багц</Tag>
                        <Text type="secondary">{record.item_count} захиалга</Text>
                    </Space>
                </Space>
            ),
        },
        {
            title: "Нийт үнэ",
            dataIndex: "total_price",
            key: "total_price",
            width: 180,
            align: "right",
            sorter: (first, second) => first.total_price - second.total_price,
            render: (value) => <Text strong style={{ color: "#32735f" }}>{formatNumber(value)} ₮</Text>,
        },
        ...(isManager ? [{
            title: "Хариуцагч",
            dataIndex: "user_id",
            key: "user_id",
            width: 180,
            ellipsis: true,
            render: (value) => getUserName(value),
        }] : []),
        {
            title: "Үйлдэл",
            key: "actions",
            width: isManager ? 90 : 230,
            align: "center",
            fixed: "right",
            render: (_, record) => (
                <Space onClick={(event) => event.stopPropagation()}>
                    {!isManager && (
                        <Button
                            className="plan-create-tender-button"
                            type="primary"
                            size="small"
                            icon={<FileAddOutlined />}
                            onClick={() => openTenderModal(record)}
                        >
                            Тендер үүсгэх
                        </Button>
                    )}
                    <PrintIcon
                        normData={record}
                        planId={record.plan_root_number}
                        UserId={record.user_id}
                    />
                </Space>
            ),
        },
    ];

    const renderBasketTable = (plan) => (
        <div className="plan-detail-panel">
            <div className="plan-detail-owner">
                <div className="plan-detail-owner__identity">
                    <ProjectOutlined />
                    <Text strong>{plan.plan_name}-ийн багцууд</Text>
                    <Tag color="blue">{plan.baskets.length} багц</Tag>
                </div>
                <Space size={16} wrap>
                    <Text type="secondary">Хариуцагч: {getUserName(plan.user_id)}</Text>
                    <Text type="secondary">{plan.item_count} захиалга</Text>
                </Space>
            </div>
            <Table
                columns={basketColumns}
                dataSource={plan.baskets}
                rowKey="key"
                size="small"
                pagination={false}
                scroll={{ x: 950 }}
                expandable={{
                    expandedRowKeys: expandedBasketKeys,
                    showExpandColumn: false,
                    rowExpandable: (record) => record.items.length > 0,
                    expandedRowRender: (basket) => (
                        <div className="basket-detail-panel">
                            <div className="basket-detail-owner">
                                <div className="basket-detail-owner__identity">
                                    <FolderOpenOutlined />
                                    <Text strong>
                                        Багц № {basket.basket_number}: {basket.basket_name}-ийн захиалгууд
                                    </Text>
                                    <Tag color="cyan">{basket.item_count} захиалга</Tag>
                                </div>
                                <Text type="secondary">Төлөвлөгөө: {plan.plan_name}</Text>
                            </div>
                            <ТөлөвлөгөөItemDetails
                                data={basket.items}
                                branches={branches}
                                onChanged={loadData}
                            />
                        </div>
                    ),
                }}
                onRow={(record) => ({
                    onClick: (event) => {
                        if (event.target.closest("button, a, input, .ant-dropdown")) return;
                        setExpandedBasketKeys((keys) => keys.includes(record.key)
                            ? keys.filter((key) => key !== record.key)
                            : [...keys, record.key]);
                    },
                    style: { cursor: "pointer" },
                })}
                rowClassName={(record) => expandedBasketKeys.includes(record.key)
                    ? "plan-basket-row plan-basket-row--expanded"
                    : "plan-basket-row"}
            />
        </div>
    );

    return (
        <>
            <div className="plan-office">
                <header className="plan-titlebar">
                    <div className="plan-titlebar__identity">
                        <span className="plan-titlebar__icon"><ProjectOutlined /></span>
                        <div>
                            <h1>Худалдан авах төлөвлөгөө</h1>
                        </div>
                    </div>
                    <div className="plan-titlebar__summary">
                        <span className="plan-summary-chip"><strong>{summary.planCount}</strong> төлөвлөгөө</span>
                        <span className="plan-summary-chip"><strong>{summary.basketCount}</strong> багц</span>
                        <span className="plan-summary-chip"><strong>{summary.itemCount}</strong> захиалга</span>
                        <span className="plan-summary-chip plan-summary-chip--price"><strong>{formatNumber(summary.totalPrice)} ₮</strong></span>
                    </div>
                </header>

                <section className="plan-commandbar">
                    <div className="plan-commandbar__primary">
                        <div className="plan-year-filter">
                            <CalendarOutlined />
                            <Button
                                className={`plan-year-button ${activeYear === "all" ? "is-active" : ""}`}
                                onClick={() => setActiveYear("all")}
                            >
                                Бүгд
                            </Button>
                            {yearOptions.map((year) => (
                                <Button
                                    key={year}
                                    className={`plan-year-button ${activeYear === year ? "is-active" : ""}`}
                                    onClick={() => setActiveYear(year)}
                                >
                                    {year}
                                </Button>
                            ))}
                        </div>
                        <Input
                            allowClear
                            className="plan-commandbar__search"
                            prefix={<SearchOutlined />}
                            placeholder="Төлөвлөгөө, багц, бараа, албаар хайх..."
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                        />
                    </div>
                    <div className="plan-commandbar__actions">
                        {expandedPlanKeys.length > 0 && (
                            <Button
                                className="plan-command-button"
                                onClick={() => {
                                    setExpandedPlanKeys([]);
                                    setExpandedBasketKeys([]);
                                }}
                            >
                                Бүгдийг хураах
                            </Button>
                        )}
                        <Button
                            className="plan-command-button"
                            icon={<ReloadOutlined />}
                            onClick={loadData}
                            loading={loading}
                        >
                            Шинэчлэх
                        </Button>
                    </div>
                </section>

                <section className="plan-workspace">
                    <Spin spinning={loading} tip="Төлөвлөгөө уншиж байна...">
                        <Table
                            className="plan-main-table"
                            columns={planColumns}
                            dataSource={filteredData}
                            rowKey="key"
                            sticky
                            pagination={{
                                defaultPageSize: 10,
                                pageSizeOptions: [5, 10, 20, 50],
                                showSizeChanger: true,
                                showTotal: (total, range) => `${range[0]}–${range[1]} / ${total}`,
                                position: ["bottomCenter"],
                            }}
                            scroll={{ x: 850 }}
                            expandable={{
                                expandedRowKeys: expandedPlanKeys,
                                showExpandColumn: false,
                                rowExpandable: (record) => record.baskets.length > 0,
                                expandedRowRender: renderBasketTable,
                            }}
                            onRow={(record) => ({
                                onClick: (event) => {
                                    if (event.target.closest("button, a, input, .ant-dropdown")) return;
                                    setExpandedPlanKeys((keys) => keys.includes(record.key)
                                        ? keys.filter((key) => key !== record.key)
                                        : [...keys, record.key]);
                                },
                                style: { cursor: "pointer" },
                            })}
                            rowClassName={(record) => expandedPlanKeys.includes(record.key)
                                ? "plan-root-row plan-root-row--expanded"
                                : "plan-root-row"}
                            locale={{ emptyText: <Empty description={searchText ? "Хайлтад тохирох төлөвлөгөө олдсонгүй" : "Төлөвлөгөө байхгүй"} /> }}
                        />
                    </Spin>
                    <footer className="plan-statusbar">
                        <span>{activeYear === "all" ? "Бүх он" : `${activeYear} он`} · Харагдаж буй: <strong>{summary.planCount}</strong> төлөвлөгөө</span>
                        <span>Нээгдсэн: <strong>{expandedPlanKeys.length}</strong></span>
                    </footer>
                </section>
            </div>

            <Modal
                rootClassName="plan-tender-modal"
                title="Тендер үүсгэх"
                open={tenderModalOpen}
                onOk={saveTender}
                onCancel={() => setTenderModalOpen(false)}
                okText="Тендер үүсгэх"
                cancelText="Болих"
                confirmLoading={tenderLoading}
                okButtonProps={{ disabled: tenderOptionsLoading || !selectedBasketIds.length }}
                width={720}
                centered
                destroyOnHidden
            >
                <Input
                    placeholder="Тендерийн дугаар"
                    value={tenderNumber}
                    onChange={(event) => setTenderNumber(event.target.value)}
                    style={{ marginBottom: 14 }}
                />

                <Card size="small" style={{ marginBottom: 14 }}>
                    <Space wrap size={18}>
                        <Text type="secondary">Сонгосон:</Text>
                        <Text strong>{selectedTenderBaskets.length} багц</Text>
                        <Text strong style={{ color: "#32735f" }}>{formatNumber(selectedTenderTotal)} ₮</Text>
                    </Space>
                </Card>

                <Spin spinning={tenderOptionsLoading}>
                    <Checkbox.Group
                        value={selectedBasketIds}
                        onChange={setSelectedBasketIds}
                        style={{ width: "100%" }}
                    >
                        <Space direction="vertical" style={{ width: "100%" }}>
                            {(currentPlan?.baskets || []).map((basket) => {
                                const basketId = String(basket.basket_id);
                                const locked = lockedBasketIds.includes(basketId);
                                return (
                                    <Card
                                        key={basket.key}
                                        size="small"
                                        styles={{ body: { padding: "10px 12px" } }}
                                        style={{ width: "100%", opacity: locked ? 0.65 : 1 }}
                                    >
                                        <Checkbox value={basketId} disabled={locked} style={{ width: "100%" }}>
                                            <Space direction="vertical" size={2}>
                                                <Space wrap>
                                                    <Text strong>{basket.basket_name}</Text>
                                                    <Tag bordered={false}>{basket.item_count} захиалга</Tag>
                                                    <Text>{formatNumber(basket.total_price)} ₮</Text>
                                                </Space>
                                                {locked && (
                                                    <Text type="danger">
                                                        <LockOutlined /> Тендерт орсон: {basketTenderMap[basket.basket_id] || basketTenderMap[basketId] || "—"}
                                                    </Text>
                                                )}
                                            </Space>
                                        </Checkbox>
                                    </Card>
                                );
                            })}
                        </Space>
                    </Checkbox.Group>
                </Spin>
            </Modal>
        </>
    );
};

export default ТөлөвлөгөөTable;
