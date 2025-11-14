import React, { useEffect, useState } from "react";
import { Table, Spin, message, Checkbox, Input } from "antd";
import axios from "axios";

const BasketItemsDetails = ({ basketIds, mode }) => {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [branches, setBranches] = useState([]);
    const [expandedRowKeys, setExpandedRowKeys] = useState([]);
    const API_BASE_URL = import.meta.env.VITE_API_URL;

    const userJson = localStorage.getItem("data");
    const user = userJson ? JSON.parse(userJson) : null;
    const isUdirdlaga =
        user?.erh?.toLowerCase() === "Удирдлага";

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
        const totalPrice = group.reduce((sum, it) => sum + Number(it.pricesum || 0), 0);
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
            render: (name) => <b>{name}</b>,
        },
        {
            title: "Барааны тоо",
            dataIndex: "count",
            key: "count",
            align: "center",
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
        { title: "Хэмжих нэгж", dataIndex: "mname", key: "mname" },
        { title: "Нэр", dataIndex: "cr4name", key: "cr4name" },
        { title: "Марк", dataIndex: "crmarkname", key: "crmarkname" },
        {
            title: "Тоо хэмжээ",
            dataIndex: "qty",
            key: "qty",
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
            dataIndex: "pricesum",
            key: "pricesum",
            align: "right",
            render: (v) => (v != null ? v.toLocaleString() + " ₮" : ""),
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
        <Table
            columns={itemColumns}
            dataSource={record.items.map((item) => ({
                key: item.basket_item_id,
                ...item,
            }))}
            pagination={false}
            size="small"
            bordered
        />
    );

    return (
        <Table
            columns={basketColumns}
            dataSource={tableData}
            expandable={{
                expandedRowRender,
                rowExpandable: (record) => record.items?.length > 0,
                expandedRowKeys,
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
                    ? "expanded-row"
                    : "",
            })}
            rowKey="key"
            pagination={false}
            bordered
            size="small"
            style={{ cursor: "pointer" }}
        />
    );
};

export default BasketItemsDetails;
