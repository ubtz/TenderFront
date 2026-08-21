import React, { useEffect, useState } from "react";
import { Table, Spin, message, Checkbox, Input, Button, Tag, Typography } from "antd";
import {
    DownOutlined,
    InboxOutlined,
    RightOutlined,
    ShoppingCartOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { getStoredUser } from "../../api/session";
import "./BasketItemsDetails.css";

const { Text } = Typography;

const formatCposCode = (value) => {
    const code = String(value || "").trim().replace(/-/g, "");
    if (!/^\d{14}$/.test(code)) return String(value || "").trim() || "-";
    return code.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})(\d{3})$/, "$1-$2-$3-$4-$5-$6");
};

const BasketItemsDetails = ({ basketIds, mode }) => {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [branches, setBranches] = useState([]);
    const [expandedRowKeys, setExpandedRowKeys] = useState([]);
    const API_BASE_URL = import.meta.env.VITE_API_URL;

    const user = getStoredUser();
    const isUdirdlaga =
        user?.erh?.toLowerCase() === "удирдлага";

    // ✅ Fetch branches once
    useEffect(() => {
        const fetchBranches = async () => {
            const cached = sessionStorage.getItem("branches");
            if (cached) return setBranches(JSON.parse(cached));

            try {
                const res = await axios.get(`${API_BASE_URL}/get/branches`);
                setBranches(res.data || []);
                sessionStorage.setItem("branches", JSON.stringify(res.data || []));
            } catch (err) {
                console.error("❌ Branches fetch error:", err);
            }
        };
        fetchBranches();
    }, []);


    // ✅ Helper: map shortName to "service (shortName)"
    const getServiceByShortName = (shortName) => {
        const branch = branches.find((b) => b.shortName === shortName);
        return branch ? `${branch.service} (${branch.shortName})` : shortName;
    };

    // ✅ Fetch basket items
    useEffect(() => {
        if (!basketIds?.length) return;
        fetchBasketItems(Array.isArray(basketIds) ? basketIds.join(",") : basketIds);
    }, [basketIds]);


    const fetchBasketItems = async (ids) => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/get/GetBasketItemsById/${ids}`);
            setItems(res.data || []);
            console.log("✅ Fetched basket items:", res.data);
        } catch (err) {
            console.error("❌ Error fetching basket items:", err);
            message.error("Сагсны өгөгдөл авахад алдаа гарлаа.");
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "400px",
                }}
            >
                <Spin size="large" />
                <span style={{ marginLeft: 10 }}>Түр хүлээнэ үү...</span>
            </div>
        );
    }

    if (!items.length)
        return <div style={{ padding: 10 }}>Сагсны мэдээлэл олдсонгүй.</div>;

    // ✅ Group items by basket_id
    const groupedByBasket = items.reduce((acc, item) => {
        if (!acc[item.basket_id]) acc[item.basket_id] = [];
        acc[item.basket_id].push(item);
        return acc;
    }, {});

    // ✅ Prepare table data (add total qty + total price)
    const tableData = Object.keys(groupedByBasket).map((basketId) => {
        const group = groupedByBasket[basketId];
        const totalQty = group.reduce((sum, it) => sum + Number(it.qty || 0), 0);
        const totalPrice = group.reduce(
            (sum, it) => sum + Number(it.qty || 0) * Number(it.price || 0),
            0
        );
        return {
            key: basketId,
            basket_id: basketId,
            basket_name: group[0]?.basket_name || "-",
            count: group.length,
            total_qty: totalQty,
            total_price: totalPrice,
            items: group,
        };
    });
    const workspaceSummary = tableData.reduce(
        (summary, basket) => ({
            itemCount: summary.itemCount + basket.count,
            totalQty: summary.totalQty + basket.total_qty,
            totalPrice: summary.totalPrice + basket.total_price,
        }),
        { itemCount: 0, totalQty: 0, totalPrice: 0 }
    );

    const handleRowClick = (record) => {
        setExpandedRowKeys((prev) =>
            prev.includes(record.key)
                ? prev.filter((k) => k !== record.key)
                : [...prev, record.key]
        );
    };

    // ✅ Main basket columns
    const basketColumns = [
        {
            title: "Багцны нэр",
            dataIndex: "basket_name",
            key: "basket_name",
            render: (name, record) => (
                <div className="basket-items-package-name">
                    <span className="basket-items-package-name__icon"><InboxOutlined /></span>
                    <span>
                        <Text strong>{name}</Text>
                        <small>Багц #{record.basket_id}</small>
                    </span>
                </div>
            ),
        },
        {
            title: "Захиалга",
            dataIndex: "count",
            key: "count",
            align: "center",
            render: (value) => <Tag bordered={false} color="blue">{value} захиалга</Tag>,
        },
        {
            title: "Нийт тоо хэмжээ",
            dataIndex: "total_qty",
            key: "total_qty",
            align: "right",
            render: (v) => (v ? v.toLocaleString() : "0"),
        },
        {
            title: "Нийт үнэ",
            dataIndex: "total_price",
            key: "total_price",
            align: "right",
            render: (value) => value.toLocaleString() + " ₮",
        },
    ];

    // ✅ Add “Ирсэн %” column only in “geree” mode
    if (mode === "geree") {
        basketColumns.push({
            title: "Ирсэн %",
            key: "arrivedPercent",
            align: "center",
            render: (_, record) => {
                const basketItems = record.items || [];
                const arrivedCount = basketItems.filter((i) => i.isArrived).length;
                const totalCount = basketItems.length || record.count || 0;
                const percent =
                    totalCount > 0
                        ? ((arrivedCount / totalCount) * 100).toFixed(0)
                        : 0;
                return <b>{percent}%</b>;
            },
        });
    }

    // ✅ Item-level columns
    const itemColumns = [
        {
            title: "Хаанаас",
            dataIndex: "dname",
            key: "dname",
            render: (value) => {
                if (!value) return "-";
                const formatted = getServiceByShortName(value);
                return <span>{formatted}</span>;
            },
        },
        { title: "Хэмжих нэгж", dataIndex: "mname", key: "mname", width: 90 },
        {
            title: "Код",
            dataIndex: "code",
            key: "code",
            width: 145,
            render: formatCposCode,
        },
        { title: "Нэр", dataIndex: "cr4name", key: "cr4name" },
        { title: "Марк", dataIndex: "crmarkname", key: "crmarkname" },
        {
            title: "Тоо хэмжээ",
            dataIndex: "qty",
            key: "qty",
            width: 90,
            align: "right",
            render: (v) => v?.toLocaleString(),
        },
        {
            title: "Үнэ",
            dataIndex: "price",
            key: "price",
            align: "right",
            render: (v) => (v != null ? v.toLocaleString() + " ₮" : ""),
        },
        {
            title: "Нийт үнэ",
            key: "pricesum",
            align: "right",
            render: (_, record) =>
                (Number(record.qty || 0) * Number(record.price || 0)).toLocaleString() + " ₮",
        },
    ];

    // ✅ Extra editable columns (only for geree mode, not for удирдлага)
    if (mode === "geree") {
        itemColumns.push(
            {
                title: "Ирсэн эсэх",
                dataIndex: "isArrived",
                key: "isArrived",
                align: "center",
                render: (value, record) => {
                    // parse arrival info (array)
                    const arrivalList = (() => {
                        try {
                            return JSON.parse(record.tailbar || "[]");
                        } catch {
                            return [];
                        }
                    })();

                    const totalArrived = arrivalList.reduce(
                        (sum, a) => sum + (Number(a.qty) || 0),
                        0
                    );

                    const isFullyArrived = totalArrived >= Number(record.qty || 0);

                    // auto-update if needed
                    if (isFullyArrived && !record.isArrived) {
                        (async () => {
                            try {
                                await axios.put(`${API_BASE_URL}/put/basketitem/state`, {
                                    basket_item_id: record.basket_item_id,
                                    isArrived: true,
                                });
                                record.isArrived = true;
                            } catch (err) {
                                console.error("❌ Auto update isArrived failed:", err);
                            }
                        })();
                    }

                    return (
                        <Checkbox
                            checked={isFullyArrived || !!value}
                            disabled={true} // auto-calculated
                        />
                    );
                },
            },
            {
                title: "Ирсэн мэдээлэл",
                dataIndex: "tailbar",
                key: "tailbar",
                render: (value, record) => {
                    const arrivalList = (() => {
                        try {
                            return JSON.parse(value || "[]");
                        } catch {
                            return [];
                        }
                    })();

                    const handleUpdate = async (newList) => {
                        const updated = items.map((it) =>
                            it.basket_item_id === record.basket_item_id
                                ? { ...it, tailbar: JSON.stringify(newList) }
                                : it
                        );
                        setItems(updated);
                        try {
                            await axios.put(`${API_BASE_URL}/put/basketitem/state`, {
                                basket_item_id: record.basket_item_id,
                                tailbar: JSON.stringify(newList),
                            });
                        } catch (err) {
                            console.error("❌ Failed to update arrivals:", err);
                        }
                    };

                    const addNew = () => handleUpdate([...arrivalList, { qty: 0, date: null }]);

                    const updateField = (idx, key, value) => {
                        const newList = arrivalList.map((a, i) =>
                            i === idx ? { ...a, [key]: value } : a
                        );
                        handleUpdate(newList);
                    };

                    const removeField = (idx) =>
                        handleUpdate(arrivalList.filter((_, i) => i !== idx));

                    const totalArrived = arrivalList.reduce(
                        (sum, a) => sum + (Number(a.qty) || 0),
                        0
                    );

                    return (
                        <div>
                            {arrivalList.map((a, idx) => (
                                <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={a.qty}
                                        placeholder="Тоо"
                                        disabled={isUdirdlaga}
                                        onChange={(e) =>
                                            updateField(idx, "qty", Number(e.target.value))
                                        }
                                        style={{ width: 80 }}
                                    />
                                    <Input
                                        type="date"
                                        value={a.date || ""}
                                        disabled={isUdirdlaga}
                                        onChange={(e) => updateField(idx, "date", e.target.value)}
                                        style={{ width: 150 }}
                                    />
                                    {!isUdirdlaga && (
                                        <button
                                            onClick={() => removeField(idx)}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: "red",
                                                cursor: "pointer",
                                            }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}
                            {!isUdirdlaga && (
                                <button
                                    onClick={addNew}
                                    style={{
                                        background: "#f0f0f0",
                                        border: "1px dashed #ccc",
                                        borderRadius: 4,
                                        padding: "2px 8px",
                                        cursor: "pointer",
                                        fontSize: 12,
                                    }}
                                >
                                    ➕ Нэмэх
                                </button>
                            )}
                            <div style={{ marginTop: 4, fontSize: 12, color: "#555" }}>
                                Нийт ирсэн: <b>{totalArrived.toLocaleString()}</b> /{" "}
                                <b>{record.qty?.toLocaleString()}</b>
                            </div>
                        </div>
                    );
                },
            }
        );
    }


    // ✅ Expanded row
    const expandedRowRender = (record) => (
        <div className="basket-items-expanded">
            <div className="basket-items-expanded__header">
                <div className="basket-items-expanded__title">
                    <ShoppingCartOutlined /> <strong>{record.basket_name}</strong>
                    <span> багцын захиалгууд</span>
                </div>
                <Tag bordered={false}>{record.count} захиалга</Tag>
            </div>
            <Table
                className="basket-items-detail-table"
                columns={itemColumns}
                dataSource={record.items.map((item) => ({
                    key: item.basket_item_id,
                    ...item,
                }))}
                pagination={false}
                size="small"
                scroll={{ x: 1080 }}
            />
        </div>
    );

    return (
        <div className="basket-items-workspace">
            <div className="basket-items-summary">
                <div><span>Багц</span><strong>{tableData.length}</strong></div>
                <div><span>Захиалга</span><strong>{workspaceSummary.itemCount}</strong></div>
                <div><span>Нийт тоо</span><strong>{workspaceSummary.totalQty.toLocaleString()}</strong></div>
                <div className="basket-items-summary__amount">
                    <span>Нийт үнэ</span>
                    <strong>{workspaceSummary.totalPrice.toLocaleString()} ₮</strong>
                </div>
            </div>
            <Table
                className="basket-items-group-table"
                columns={basketColumns}
                dataSource={tableData}
                expandable={{
                    expandedRowRender,
                    rowExpandable: (record) => record.items?.length > 0,
                    expandedRowKeys,
                    expandIcon: ({ expanded, onExpand, record }) => (
                        <Button
                            type="text"
                            shape="circle"
                            className="basket-items-expand-button"
                            icon={expanded ? <DownOutlined /> : <RightOutlined />}
                            onClick={(event) => {
                                event.stopPropagation();
                                onExpand(record, event);
                            }}
                        />
                    ),
                    onExpand: (expanded, record) => {
                        setExpandedRowKeys((prev) =>
                            expanded
                                ? [...prev, record.key]
                                : prev.filter((k) => k !== record.key)
                        );
                    },
                }}
                onRow={(record) => ({
                    onClick: () => handleRowClick(record),
                    className: expandedRowKeys.includes(record.key)
                        ? "basket-items-parent-row--expanded"
                        : "",
                })}
                rowKey="key"
                pagination={false}
                size="middle"
                tableLayout="fixed"
            />
        </div>
    );
};

export default BasketItemsDetails;
