import React, { useEffect, useState } from "react";
import { Table, Input, Button, Space, Modal, message } from "antd";
import axios from "axios";
import Highlighter from "react-highlight-words";

import { DeleteOutlined } from "@ant-design/icons";
import PrintIcon from "./PrintIcon"; // Adjust the import path as needed

function ХяналтTable() {
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [searchText, setSearchText] = useState("");
    const API_BASE_URL = import.meta.env.VITE_API_URL;
    const [newQty, setNewQty] = useState("");
    const [newPrice, setNewPrice] = useState("");
    const [dataSource, setDataSource] = useState(data);

    // Calculate new_pricesum automatically
    const newPriceSum =
        newQty && newPrice ? (parseFloat(newQty) * parseFloat(newPrice)).toFixed(2) : "";

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [reason, setReason] = useState("");
    const [selectedRecord, setSelectedRecord] = useState(null);

    const handleSaveClick = (record) => {
        setSelectedRecord(record); // keep reference to the item for saving
        setReason(record.change_reason || ""); // populate modal input
        setIsModalVisible(true);
    };
    const handleOk = async () => {
        if (!selectedRecord?.change_reason?.trim()) return;

        const payload = {
            basket_item_id: selectedRecord.basket_item_id,
            new_price: selectedRecord.new_price,
            new_qty: selectedRecord.new_qty,
            new_pricesum: selectedRecord.new_pricesum,
            change_reason: selectedRecord.change_reason,
        };

        try {
            const response = await axios.put(`${API_BASE_URL}/put/basket-item`, payload);

            const postedReason = response.data.change_reason ?? selectedRecord.change_reason;

            // Update table nested data
            setData((prev) =>
                prev.map((plan) => ({
                    ...plan,
                    baskets: plan.baskets.map((basket) => ({
                        ...basket,
                        items: basket.items.map((item) =>
                            item.basket_item_id === selectedRecord.basket_item_id
                                ? { ...item, change_reason: postedReason }
                                : item
                        ),
                    })),
                }))
            );

            // Update modal state
            setSelectedRecord((prev) => ({ ...prev, change_reason: postedReason }));

            message.success("Амжилттай хадгалагдлаа!");
            setIsModalVisible(false);
        } catch (error) {
            console.error(error);
            message.error("Хадгалах амжилтгүй боллоо!");
        }
    };




    const handleCancel = () => {
        setReason("");
        setIsModalVisible(false);
    };

    useEffect(() => {
        axios
            .get(`${API_BASE_URL}/get/GetAll`)
            .then((response) => {
                const transformed = response.data
                    .sort((a, b) => a.plan_root_number - b.plan_root_number)
                    .map((planGroup, index) => {
                        // Filter only baskets with is_valid === true
                        const baskets = planGroup.baskets
                            .filter((basket) => basket.is_valid) // ✅ filter here
                            .map((basket) => ({
                                key: `basket-${basket.basket_id}`,
                                basket_id: basket.basket_id,
                                basket_number: basket.basket_number,
                                basket_name: basket.basket_name,
                                basket_type: basket.basket_type,
                                plan_name: basket.plan_name,
                                set_date: formatDate(basket.set_date),
                                publish_date: formatDate(basket.publish_date),
                                total_price: basket.items.reduce(
                                    (acc, item) => acc + (item.pricesum || 0),
                                    0
                                ),
                                items: basket.items,
                                new_qty: basket.new_qty || "",
                                new_price: basket.new_price || "",
                                new_pricesum: basket.new_pricesum || "",
                            }));

                        const planTotal = baskets.reduce((acc, b) => acc + b.total_price, 0);

                        return {
                            key: `plan-${planGroup.plan_root_number}`,
                            index: index + 1,
                            plan_root_number: planGroup.plan_root_number,
                            plan_name: planGroup.plan_name,
                            baskets,
                            total_price: planTotal,
                        };
                    })
                    // Optional: remove plan groups that now have 0 baskets
                    .filter((planGroup) => planGroup.baskets.length > 0);

                setData(transformed);
                setFilteredData(transformed); // initial filtered = full data
            })
            .catch((error) => {
                console.error("❌ Error fetching basket data:", error);
            });
    }, []);

    console.log("Data fetched:", data);
    function formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString("mn-MN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
    }

    // -------------------- Global Search --------------------
    const handleGlobalSearch = (e) => {
        const value = e.target.value;
        setSearchText(value);
        if (!value) {
            setFilteredData(data);
            return;
        }
        const lowerValue = value.toLowerCase();

        const filtered = data
            .map((plan) => {
                const filteredBaskets = plan.baskets
                    .map((basket) => {
                        const filteredItems = basket.items.filter((item) =>
                            Object.values(item).some((val) =>
                                val?.toString().toLowerCase().includes(lowerValue)
                            )
                        );
                        const basketMatch = Object.values(basket).some((val) =>
                            val?.toString().toLowerCase().includes(lowerValue)
                        );
                        if (filteredItems.length > 0 || basketMatch) {
                            return { ...basket, items: filteredItems };
                        }
                        return null;
                    })
                    .filter(Boolean);

                const planMatch = Object.values(plan).some((val) =>
                    val?.toString().toLowerCase().includes(lowerValue)
                );

                if (filteredBaskets.length > 0 || planMatch) {
                    return { ...plan, baskets: filteredBaskets };
                }
                return null;
            })
            .filter(Boolean);

        setFilteredData(filtered);
    };
    const handleFieldChange = (field, value, record) => {
        setData((prev) =>
            prev.map((plan) => ({
                ...plan,
                baskets: plan.baskets.map((basket) => ({
                    ...basket,
                    items: basket.items.map((item) => {
                        if (item.basket_item_id === record.basket_item_id) {
                            const updated = {
                                ...item,
                                [field]: field === "change_reason" ? value : Number(value) || 0,
                            };

                            // auto-calc new_pricesum
                            if (field === "new_qty" || field === "new_price") {
                                updated.new_pricesum =
                                    (updated.new_qty ?? item.new_qty ?? 0) *
                                    (updated.new_price ?? item.new_price ?? 0);
                            }

                            return updated;
                        }
                        return item;
                    }),
                })),
            }))
        );

        // keep filteredData in sync
        setFilteredData((prev) =>
            prev.map((plan) => ({
                ...plan,
                baskets: plan.baskets.map((basket) => ({
                    ...basket,
                    items: basket.items.map((item) => {
                        if (item.basket_item_id === record.basket_item_id) {
                            const updated = {
                                ...item,
                                [field]: field === "change_reason" ? value : Number(value) || 0,
                            };

                            if (field === "new_qty" || field === "new_price") {
                                updated.new_pricesum =
                                    (updated.new_qty ?? item.new_qty ?? 0) *
                                    (updated.new_price ?? item.new_price ?? 0);
                            }

                            return updated;
                        }
                        return item;
                    }),
                })),
            }))
        );
    };

    // -------------------- Columns --------------------
    const planColumns = [
        {
            title: "Төлөвлөгөө дугаар",
            dataIndex: "plan_root_number",
            key: "plan_root_number",
            width: 100,
            render: (value) => <b>{value}</b>,
        },
        { title: "Төлөвлөгөө нэр", dataIndex: "plan_name", key: "plan_name" },
        {
            title: "Нийт мөнгөн дүн, Төг",
            dataIndex: "total_price",
            key: "total_price",
            render: (value) => Number(value).toLocaleString(),
        },
        {
            title: "",
            key: "action",
            fixed: "right",
            width: 100,

            render: (_, row) => {

                return (
                    <Space size="small">

                        <PrintIcon normData={row} planId={row.plan_root_number} />

                    </Space>
                );
            }
        }
    ];

    const basketColumns = [
        {
            title: "Ангилал",
            dataIndex: "basket_type",
            key: "basket_type",
            sorter: (a, b) => a.basket_type.localeCompare(b.basket_type),
            defaultSortOrder: "ascend",
            width: 220,
            render: (value) => <span style={{ color: "#1890ff" }}>{value}</span>,
        },
        { title: "Багц дугаар", dataIndex: "basket_number", key: "basket_number", width: 100 },
        { title: "Багцны нэр", dataIndex: "basket_name", key: "basket_name", width: 320 },
        { title: "Огноо", dataIndex: "set_date", key: "set_date", render: (value) => <span style={{ color: "#888" }}>{value}</span> },
        { title: "Нийт мөнгөн дүн", dataIndex: "total_price", key: "total_price", render: (value) => Number(value).toLocaleString() },
    ];

    const itemColumns = [
        { title: "Код", dataIndex: "code", key: "code" },
        { title: "Салбар нэгж", dataIndex: "dname", key: "dname" },
        {
            title: "Одоогийн мэдээлэл",
            key: "currentInfo",
            render: (_, record) => (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "70px", fontSize: "12px", color: "#555" }}>Тоо:</span>
                        <Input disabled value={record.qty} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "70px", fontSize: "12px", color: "#555" }}>Үнэ:</span>
                        <Input disabled value={record.price.toLocaleString()} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "70px", fontSize: "12px", color: "#555" }}>Нийт үнэ, Төг:</span>
                        <Input disabled value={(record.qty * record.price).toLocaleString()} />
                    </div>
                </div>
            ),
        },
        {
            width: 100,
            title: "Үйлдэл",
            key: "action",
            render: (_, record) => (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {/* <Button
                        type="primary"
                        size="small"
                        onClick={() => handleSaveClick(record)}
                    >
                        Хадгалах
                    </Button> */}
                    <Button
                        type="text"
                        icon={<DeleteOutlined style={{ color: "red" }} />}
                        onClick={() => console.log("Delete item:", record.code)}
                    >
                        Устгах
                    </Button>
                </div>
            ),
        }
    ];


    // -------------------- Expanded Rows --------------------
    const basketExpandedRowRender = (basket) => (
        <Table columns={itemColumns} dataSource={basket.items.map(item => ({ key: item.basket_item_id, ...item }))} pagination={false} size="small" bordered />
    );

    const planExpandedRowRender = (plan) => (
        <Table
            columns={basketColumns}
            dataSource={plan.baskets}
            pagination={false}
            size="small"
            bordered
            expandable={{ expandedRowRender: basketExpandedRowRender, rowExpandable: record => record.items?.length > 0 }}
        />
    );

    return (
        <>
            <Input
                placeholder="Хайх..."
                value={searchText}
                onChange={handleGlobalSearch}
                style={{ width: 300, marginBottom: 16 }}
                allowClear
            />

            <Table
                columns={planColumns}
                dataSource={filteredData}
                bordered
                pagination={{ pageSize: 5 }}
                expandable={{ expandedRowRender: planExpandedRowRender, rowExpandable: record => record.baskets?.length > 0 }}
            />
            <Modal
                title="Өөрчлөлтийн шалтгаан"
                open={isModalVisible}
                onOk={handleOk}
                onCancel={handleCancel}
                okText="Хадгалах"
                cancelText="Болих"
            >
                <Input.TextArea
                    rows={4}
                    value={selectedRecord?.change_reason ?? ""}
                    onChange={(e) =>
                        setSelectedRecord((prev) => ({ ...prev, change_reason: e.target.value }))
                    }
                />
            </Modal>
        </>
    );
}

export default ХяналтTable;
