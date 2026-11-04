import { useEffect, useMemo, useState } from "react";
import { Button, Dropdown, Empty, Modal, Space, Table, Tag, Typography, message } from "antd";
import {
    FileTextOutlined,
    MoreOutlined,
    RollbackOutlined,
    ToolOutlined,
} from "@ant-design/icons";
import PropTypes from "prop-types";

const PLAN_BASE_URL = "http://192.168.4.119:3114/static/upload/plan";
const TECH_BASE_URL = "http://192.168.4.119:3114/static/upload/tech";
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
const formatCposCode = (value) => {
    const original = normalize(value);
    const code = original.replace(/-/g, "");
    if (!/^\d{14}$/.test(code)) return original || "-";
    return code.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})(\d{3})$/, "$1-$2-$3-$4-$5-$6");
};
const openDocument = (baseUrl, path) => {
    window.open(`${baseUrl}/${normalize(path).replace(/^\//, "")}`, "_blank", "noopener,noreferrer");
};

const ТөлөвлөгөөItemDetails = ({
    data = [],
    branches = [],
    onChanged,
    onReturnToMyBasket,
    onReturnWholeBasket,
}) => {
    const [tableData, setTableData] = useState(data);
    const [expandedKeys, setExpandedKeys] = useState([]);
    const [returnRecord, setReturnRecord] = useState(null);
    const [returningMode, setReturningMode] = useState("");

    useEffect(() => setTableData(data), [data]);

    const branchMap = useMemo(
        () => new Map(branches.map((branch) => [branch.shortName, branch.service])),
        [branches]
    );

    const groupedData = useMemo(() => {
        const groups = new Map();
        tableData.forEach((item, index) => {
            const code = normalize(item.code);
            const key = code ? `code-${code}` : `item-${normalize(item.BasketItemId || item.basket_item_id || item.id) || index}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({
                ...item,
                rowKey: `${key}-${normalize(item.basket_item_id || item.BasketItemId || item.id || item.rid) || index}`,
            });
        });

        return [...groups.entries()].map(([key, items]) => ({
            key,
            code: normalize(items[0]?.code),
            cr4name: normalize(items[0]?.cr4name) || "Нэргүй бараа",
            crmarkname: normalize(items[0]?.crmarkname),
            crbrandname: normalize(items[0]?.crbrandname),
            mname: normalize(items[0]?.mname),
            usize: normalize(items[0]?.usize),
            price: toNumber(items[0]?.price),
            packageNames: [...new Set(items.map((item) => normalize(item.pkgname) || normalize(item.pkgno)).filter(Boolean))],
            departments: [...new Set(items.map((item) => normalize(item.dname)).filter(Boolean))],
            quantity: items.reduce((sum, item) => sum + toNumber(item.qty), 0),
            totalPrice: items.reduce((sum, item) => sum + itemTotal(item), 0),
            planurl: normalize(items[0]?.planurl),
            techurl: normalize(items[0]?.techurl),
            items,
        }));
    }, [tableData]);

    const returnOrderToMyBasket = async (record) => {
        setReturningMode("single");
        try {
            const ids = record.items
                .map((item) => unwrap(item.BasketItemId) || item.basket_item_id || item.id)
                .filter(Boolean);
            if (!ids.length) throw new Error("Захиалгын мөрийн дугаар олдсонгүй");
            if (!onReturnToMyBasket) throw new Error("Миний сагс руу буцаах үйлдэл тохируулагдаагүй байна");

            await onReturnToMyBasket(ids);
            const returnedIds = new Set(ids.map(String));
            setTableData((currentItems) => currentItems.filter((item) => !returnedIds.has(String(
                unwrap(item.BasketItemId) || item.basket_item_id || item.id
            ))));
            setExpandedKeys((keys) => keys.filter((key) => key !== record.key));
            await onChanged?.();
            setReturnRecord(null);
            message.success("Сонгосон захиалгыг Миний сагс → Багцалсан хэсэгт буцаалаа");
        } catch (error) {
            console.error("Plan order return failed:", error);
            const responseData = error.response?.data;
            const responseMessage = typeof responseData === "string"
                ? responseData
                : responseData?.message || responseData?.error;
            message.error(responseMessage || error.message || "Захиалга буцаахад алдаа гарлаа");
        } finally {
            setReturningMode("");
        }
    };

    const returnWholeBasket = async () => {
        if (!onReturnWholeBasket) {
            message.error("Багцыг бүхлээр нь буцаах үйлдэл тохируулагдаагүй байна");
            return;
        }
        setReturningMode("all");
        try {
            const succeeded = await onReturnWholeBasket();
            if (succeeded !== false) setReturnRecord(null);
        } finally {
            setReturningMode("");
        }
    };

    const itemColumns = [
        { title: "№", key: "index", width: "4%", align: "center", render: (_, __, index) => index + 1 },
        {
            title: "Бараа / Код",
            key: "product",
            width: "24%",
            render: (_, item) => (
                <Space direction="vertical" size={1} className="plan-order-product-cell">
                    <Text strong ellipsis={{ tooltip: item.cr4name }}>{normalize(item.cr4name) || "-"}</Text>
                    <Text type="secondary" copyable={item.code ? { text: normalize(item.code) } : false}>
                        {formatCposCode(item.code)}
                    </Text>
                </Space>
            ),
        },
        {
            title: "Марк / Брэнд",
            key: "modelBrand",
            width: "20%",
            render: (_, item) => (
                <Space direction="vertical" size={1} className="plan-order-product-cell">
                    <Text ellipsis={{ tooltip: item.crmarkname }}>{normalize(item.crmarkname) || "-"}</Text>
                    <Text type="secondary" ellipsis={{ tooltip: item.crbrandname }}>
                        {normalize(item.crbrandname) || "Брэндгүй"}
                    </Text>
                </Space>
            ),
        },
        {
            title: "Зураг / Нэгж",
            key: "drawingUnit",
            width: "15%",
            render: (_, item) => (
                <Space direction="vertical" size={1}>
                    <Text>{normalize(item.zno) || "Зураггүй"}</Text>
                    <Text type="secondary">{normalize(item.usize) || "Нэгжгүй"}</Text>
                </Space>
            ),
        },
        {
            title: "Хэмжих нэгж",
            dataIndex: "mname",
            key: "mname",
            width: "12%",
            render: (value) => normalize(value) || "-",
        },
        {
            title: "Тоо хэмжээ / Үнэ",
            key: "calculation",
            width: "25%",
            align: "right",
            render: (_, item) => (
                <div className="plan-order-calculation">
                    <Text type="secondary">
                        {formatNumber(item.qty)} × {formatNumber(item.price)} ₮
                    </Text>
                    <Text strong>{itemTotal(item).toLocaleString()} ₮</Text>
                </div>
            ),
        },
    ];

    const columns = [
        {
            title: "Барааны нэр",
            dataIndex: "cr4name",
            key: "cr4name",
            width: "25%",
            render: (value, record) => (
                <Space direction="vertical" size={2} className="plan-order-product-cell">
                    <Text strong ellipsis={{ tooltip: value }}>{value}</Text>
                    <Space size={5} wrap>
                        {record.crmarkname && <Text type="secondary">{record.crmarkname}</Text>}
                        {record.items.length > 1 && <Tag color="green">{record.items.length} захиалга нэгтгэсэн</Tag>}
                    </Space>
                    <Text type="secondary">{formatCposCode(record.code)}</Text>
                </Space>
            ),
        },
        {
            title: "Захиалгын багц",
            dataIndex: "packageNames",
            key: "packageNames",
            width: "17%",
            ellipsis: true,
            render: (values) => values.join(", ") || "-",
        },
        {
            title: "Алба",
            dataIndex: "departments",
            key: "departments",
            width: "15%",
            ellipsis: true,
            render: (values) => values.map((value) => branchMap.get(value) || value).join(", ") || "-",
        },
        { title: "Тоо хэмжээ", dataIndex: "quantity", key: "quantity", width: "8%", align: "right", render: formatNumber },
        { title: "Нэгж үнэ", dataIndex: "price", key: "price", width: "11%", align: "right", render: (value) => `${formatNumber(value)} ₮` },
        {
            title: "Нийт үнэ",
            dataIndex: "totalPrice",
            key: "totalPrice",
            width: "12%",
            align: "right",
            render: (value) => <Text strong>{formatNumber(value)} ₮</Text>,
        },
        {
            title: "Үйлдэл",
            key: "actions",
            width: "12%",
            align: "center",
            render: (_, record) => {
                const menuItems = [
                    record.planurl && {
                        key: "plan",
                        icon: <FileTextOutlined />,
                        label: "План үзэх",
                        onClick: () => openDocument(PLAN_BASE_URL, record.planurl),
                    },
                    record.techurl && {
                        key: "tech",
                        icon: <ToolOutlined />,
                        label: "Техникийн баримт үзэх",
                        onClick: () => openDocument(TECH_BASE_URL, record.techurl),
                    },
                    (record.planurl || record.techurl) && { type: "divider" },
                    {
                        key: "return",
                        danger: true,
                        icon: <RollbackOutlined />,
                        label: "Миний сагс руу буцаах",
                        onClick: () => setReturnRecord(record),
                    },
                ].filter(Boolean);

                return (
                    <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
                        <Button size="small" icon={<MoreOutlined />}>Үйлдэл</Button>
                    </Dropdown>
                );
            },
        },
    ];

    return (
        <>
            <Table
                className="plan-item-groups-table"
                columns={columns}
                dataSource={groupedData}
                rowKey="key"
                size="small"
                pagination={groupedData.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
                expandable={{
                    expandedRowKeys: expandedKeys,
                    showExpandColumn: false,
                    rowExpandable: (record) => record.items.length > 0,
                    expandedRowRender: (record) => (
                        <div className="plan-item-lines-panel">
                            <Table
                                className="plan-item-lines-table"
                                columns={itemColumns}
                                dataSource={record.items}
                                rowKey="rowKey"
                                size="small"
                                pagination={false}
                            />
                        </div>
                    ),
                }}
                onRow={(record) => ({
                    onClick: (event) => {
                        if (event.target.closest("button, a, input, .ant-dropdown")) return;
                        setExpandedKeys((keys) => keys.includes(record.key)
                            ? keys.filter((key) => key !== record.key)
                            : [...keys, record.key]);
                    },
                    style: { cursor: "pointer" },
                })}
                locale={{ emptyText: <Empty description="Захиалгын багц байхгүй" /> }}
            />
            <Modal
                open={Boolean(returnRecord)}
                title="Миний сагс руу буцаах"
                centered
                width={560}
                destroyOnHidden
                closable={!returningMode}
                maskClosable={!returningMode}
                onCancel={() => setReturnRecord(null)}
                footer={[
                    <Button key="cancel" disabled={Boolean(returningMode)} onClick={() => setReturnRecord(null)}>
                        Болих
                    </Button>,
                    <Button
                        key="single"
                        icon={<RollbackOutlined />}
                        loading={returningMode === "single"}
                        disabled={returningMode === "all"}
                        onClick={() => returnOrderToMyBasket(returnRecord)}
                    >
                        Энэ захиалгыг буцаах
                    </Button>,
                    <Button
                        key="all"
                        type="primary"
                        danger
                        icon={<RollbackOutlined />}
                        loading={returningMode === "all"}
                        disabled={returningMode === "single"}
                        onClick={returnWholeBasket}
                    >
                        Багцыг бүхлээр нь буцаах
                    </Button>,
                ]}
            >
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Text>
                        <Text strong>{returnRecord?.cr4name || "Сонгосон захиалга"}</Text>-г дангаар нь эсвэл
                        төлөвлөгөөний багцыг бүхлээр нь буцаах сонголтоо хийнэ үү.
                    </Text>
                    <Text type="secondary">
                        Буцаасан мэдээлэл Миний сагс → Багцалсан хэсэгт шилжинэ.
                    </Text>
                    <Space size={8} wrap>
                        <Tag color="blue">Сонгосон: {returnRecord?.items?.length || 0} мөр</Tag>
                        <Tag color="gold">Багц бүхэлдээ: {tableData.length} мөр</Tag>
                    </Space>
                </Space>
            </Modal>
        </>
    );
};

ТөлөвлөгөөItemDetails.propTypes = {
    data: PropTypes.array,
    branches: PropTypes.array,
    onChanged: PropTypes.func,
    onReturnToMyBasket: PropTypes.func,
    onReturnWholeBasket: PropTypes.func,
};

export default ТөлөвлөгөөItemDetails;
