import { useEffect, useMemo, useState } from "react";
import { Button, Dropdown, Empty, Popconfirm, Space, Table, Tag, Typography, message } from "antd";
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

const ТөлөвлөгөөItemDetails = ({ data = [], branches = [], onChanged, onReturnToMyBasket }) => {
    const [tableData, setTableData] = useState(data);
    const [expandedKeys, setExpandedKeys] = useState([]);
    const [deletingKey, setDeletingKey] = useState("");
    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("data") || "{}");
        } catch {
            return {};
        }
    }, []);

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

    const handleDelete = async (record) => {
        setDeletingKey(record.key);
        try {
            const ids = record.items
                .map((item) => unwrap(item.BasketItemId) || item.basket_item_id || item.id)
                .filter(Boolean);
            if (!ids.length) throw new Error("Багцын мөрийн дугаар олдсонгүй");

            if (onReturnToMyBasket) {
                await onReturnToMyBasket(ids);
            } else {
                throw new Error("Миний сагс руу буцаах үйлдэл тохируулагдаагүй байна");
            }
            const deletedIds = new Set(ids.map(String));
            const remainingItems = tableData.filter((item) => !deletedIds.has(String(
                unwrap(item.BasketItemId) || item.basket_item_id || item.id
            )));
            setTableData(remainingItems);
            setExpandedKeys((keys) => keys.filter((key) => key !== record.key));
            await onChanged?.();
            message.success("Захиалгыг Миний сагс → Багцлаагүй хэсэгт буцаалаа");
        } catch (error) {
            console.error("Plan item return failed:", error);
            const responseData = error.response?.data;
            const responseMessage = typeof responseData === "string"
                ? responseData
                : responseData?.message || responseData?.error;
            message.error(responseMessage || error.message || "Захиалга буцаахад алдаа гарлаа");
        } finally {
            setDeletingKey("");
        }
    };

    const itemColumns = [
        { title: "№", key: "index", width: 48, align: "center", render: (_, __, index) => index + 1 },
        { title: "Барааны нэр", dataIndex: "cr4name", key: "cr4name", width: 190, ellipsis: true },
        { title: "Марк", dataIndex: "crmarkname", key: "crmarkname", width: 170, ellipsis: true },
        { title: "Зургийн №", dataIndex: "zno", key: "zno", width: 105, ellipsis: true },
        { title: "Нэгж", dataIndex: "usize", key: "usize", width: 90 },
        { title: "Брэнд", dataIndex: "crbrandname", key: "crbrandname", width: 130, ellipsis: true },
        { title: "Хэмжих нэгж", dataIndex: "mname", key: "mname", width: 115 },
        { title: "Код", dataIndex: "code", key: "code", width: 165, render: formatCposCode },
        {
            title: "Тоо × Нэгж үнэ = Нийт",
            key: "calculation",
            width: 300,
            align: "right",
            render: (_, item) => (
                <Text style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {formatNumber(item.qty)} × {formatNumber(item.price)} ₮ ={" "}
                    <Text strong style={{ color: "#389e0d" }}>{itemTotal(item).toLocaleString()} ₮</Text>
                </Text>
            ),
        },
    ];

    const columns = [
        {
            title: "Барааны нэр",
            dataIndex: "cr4name",
            key: "cr4name",
            width: 230,
            render: (value, record) => (
                <Space direction="vertical" size={2}>
                    <Text strong>{value}</Text>
                    <Space size={5} wrap>
                        {record.crmarkname && <Text type="secondary">{record.crmarkname}</Text>}
                        {record.items.length > 1 && <Tag color="green">{record.items.length} захиалга нэгтгэсэн</Tag>}
                    </Space>
                </Space>
            ),
        },
        { title: "Код", dataIndex: "code", key: "code", width: 165, render: formatCposCode },
        {
            title: "Захиалгын багц",
            dataIndex: "packageNames",
            key: "packageNames",
            width: 220,
            ellipsis: true,
            render: (values) => values.join(", ") || "-",
        },
        {
            title: "Алба",
            dataIndex: "departments",
            key: "departments",
            width: 180,
            ellipsis: true,
            render: (values) => values.map((value) => branchMap.get(value) || value).join(", ") || "-",
        },
        { title: "Тоо хэмжээ", dataIndex: "quantity", key: "quantity", width: 110, align: "right", render: formatNumber },
        { title: "Нэгж үнэ", dataIndex: "price", key: "price", width: 125, align: "right", render: (value) => `${formatNumber(value)} ₮` },
        {
            title: "Нийт үнэ",
            dataIndex: "totalPrice",
            key: "totalPrice",
            width: 155,
            align: "right",
            render: (value) => <Text strong>{formatNumber(value)} ₮</Text>,
        },
        {
            title: "Үйлдэл",
            key: "actions",
            width: 115,
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
                ].filter(Boolean);

                return (
                    <Space>
                        {menuItems.length > 0 && (
                            <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
                                <Button size="small" icon={<MoreOutlined />}>Баримт</Button>
                            </Dropdown>
                        )}
                        {user?.erh !== "Удирдлага" && (
                            <Popconfirm
                                title="Захиалгыг багцаас хасах уу?"
                                description="Захиалгууд Миний сагс → Багцлаагүй хэсэгт шилжинэ."
                                onConfirm={() => handleDelete(record)}
                                okText="Миний сагс руу буцаах"
                                cancelText="Болих"
                            >
                                <Button
                                    size="small"
                                    icon={<RollbackOutlined />}
                                    loading={deletingKey === record.key}
                                />
                            </Popconfirm>
                        )}
                    </Space>
                );
            },
        },
    ];

    return (
        <Table
            columns={columns}
            dataSource={groupedData}
            rowKey="key"
            size="small"
            pagination={groupedData.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
            scroll={{ x: 1180 }}
            expandable={{
                expandedRowKeys: expandedKeys,
                showExpandColumn: false,
                rowExpandable: (record) => record.items.length > 0,
                expandedRowRender: (record) => (
                    <div style={{ padding: "8px 10px 14px" }}>
                        <Table
                            columns={itemColumns}
                            dataSource={record.items}
                            rowKey="rowKey"
                            size="small"
                            pagination={false}
                            scroll={{ x: 1150 }}
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
    );
};

ТөлөвлөгөөItemDetails.propTypes = {
    data: PropTypes.array,
    branches: PropTypes.array,
    onChanged: PropTypes.func,
    onReturnToMyBasket: PropTypes.func,
};

export default ТөлөвлөгөөItemDetails;
