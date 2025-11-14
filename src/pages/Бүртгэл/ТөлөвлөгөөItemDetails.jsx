import React, { useEffect, useMemo, useState } from "react";
import { Table, Button, Space, Popconfirm, message } from "antd";
import { groupBy } from "lodash";
import axios from "axios";

const PLAN_BASE_URL = "http://192.168.4.119:3114/static/upload/plan";
const TECH_BASE_URL = "http://192.168.4.119:3114/static/upload/tech";

const ТөлөвлөгөөItemDetails = ({ data = [], onSelectRows }) => {
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [tableData, setTableData] = useState(data);
    const [branches, setBranches] = useState([]); // ✅ store branch list
    const API_BASE_URL = import.meta.env.VITE_API_URL;

    const userJson = localStorage.getItem("data");
    const user = userJson ? JSON.parse(userJson) : null;

    // ✅ Fetch branches on mount
    useEffect(() => {
        axios
            .get(`${API_BASE_URL}/get/branches`)
            .then((res) => {
                setBranches(res.data || []);
            })
            .catch((err) => {
                console.error("❌ Error fetching branches:", err);
            });
    }, []);
    const getServiceByShortName = (shortName) => {
        const found = branches.find((b) => b.shortName === shortName);
        return found ? found.service : "";
    };

    // 🧮 Group items by pkgno
    const groupedData = useMemo(() => {
        const grouped = groupBy(tableData, (item) => item.pkgno?.String || "Тодорхойгүй");
        return Object.keys(grouped).map((pkgno) => {
            const items = grouped[pkgno];
            return {
                key: pkgno,
                pkgno,
                pkgdate: items[0]?.pkgdate?.String || "",
                dname: items[0]?.dname || "",
                qty: items.reduce((sum, i) => sum + Number(i.qty || 0), 0),
                pricesum: items.reduce((sum, i) => sum + Number(i.pricesum || 0), 0),
                planurl: items[0]?.planurl?.String || "",
                techurl: items[0]?.techurl?.String || "",
                items,
            };
        });
    }, [tableData]);

    // ✅ Helper: find service by branch shortName

    // ✅ Row selection
    const rowSelection = {
        selectedRowKeys,
        onChange: (keys, selectedRows) => {
            const allKeys = [];
            selectedRows.forEach((row) => {
                allKeys.push(row.key);
                row.items.forEach((_, idx) => allKeys.push(`${row.key}-${idx}`));
            });
            setSelectedRowKeys(allKeys);
            if (onSelectRows) onSelectRows(selectedRows);
        },
        checkStrictly: false,
    };

    // ✅ Delete handler
    const handleDelete = async (pkgno, pkgdate) => {
        try {
            console.log("🧾 Deleting package:", { pkgno, pkgdate });

            const targetGroup = tableData.filter(
                (item) =>
                    String(item.pkgno?.String || item.pkgno) === String(pkgno) &&
                    String(item.pkgdate?.String || item.pkgdate)?.slice(0, 10) ===
                    String(pkgdate)?.slice(0, 10)
            );

            if (targetGroup.length === 0) {
                message.warning("Багц олдсонгүй!");
                return;
            }

            for (const item of targetGroup) {
                const id = item.BasketItemId?.Int64 || item.basket_item_id || item.id;
                if (!id) continue;
                await axios.delete(`${API_BASE_URL}/delete/basket-item`, { params: { id } });
            }

            const formattedDate = new Date(pkgdate)
                .toISOString()
                .split("T")[0]
                .replace(/-/g, "/");

            await axios.post("http://192.168.4.107:8008/v1/orders/status", {
                Pkgno: pkgno,
                Pkgdate: formattedDate,
                State: "1",
            });

            setTableData((prev) =>
                prev.filter(
                    (item) =>
                        !(
                            String(item.pkgno?.String || item.pkgno) === String(pkgno) &&
                            String(item.pkgdate?.String || item.pkgdate)?.slice(0, 10) ===
                            String(pkgdate)?.slice(0, 10)
                        )
                )
            );

            message.success(`✅ Багц №${pkgno} (${pkgdate}) амжилттай устгагдлаа.`);
        } catch (err) {
            console.error("❌ Delete or status update error:", err);
            if (err.response) {
                message.error(`⚠️ Серверийн хариу: ${err.response.data?.message || "алдаа"}`);
            } else {
                message.error("⚠️ Сүлжээний алдаа гарлаа!");
            }
        }
    };

    // 🧱 Columns
    const columns = [
        { title: "Багц №", dataIndex: "pkgno", key: "pkgno", width: "6%" },
        {
            title: "Сар",
            dataIndex: "pkgdate",
            key: "pkgdate",
            width: "6%",
            render: (text) => {
                if (!text) return "-";
                const d = new Date(text);
                if (isNaN(d)) return "-";
                return `${d.getMonth() + 1} сар`;
            },
        },
        {
            title: "Алба",
            dataIndex: "dname",
            key: "dname",
            width: "10%",
            render: (value) => {
                const service = getServiceByShortName(value);
                return service ? (
                    <span>
                        {service} <span style={{ color: "#888" }}>({value})</span>
                    </span>
                ) : (
                    <span>{value}</span>
                );
            },
        },

        {
            title: "Нийт Тоо хэмжээ",
            dataIndex: "qty",
            key: "qty",
            width: "10%",
            render: (value) => Number(value).toLocaleString(),
        },
        {
            title: "Нийт Үнэ",
            dataIndex: "pricesum",
            key: "pricesum",
            width: "10%",
            render: (value) => Number(value).toLocaleString(),
        },
        {
            title: "Захиалгууд",
            key: "items",
            width: "50%",
            render: (_, record) => (
                <Table
                    size="small"
                    columns={[
                        { title: "Нэр", dataIndex: "cr4name", key: "cr4name", width: "20%" },
                        { title: "Марк", dataIndex: "crmarkname", key: "crmarkname", width: "20%" },
                        {
                            title: "Тоо хэмжээ",
                            dataIndex: "qty",
                            key: "qty",
                            width: "10%",
                            render: (v) => Number(v).toLocaleString(),
                        },
                        { title: "нэгж", dataIndex: "mname", key: "mname", width: "10%" },
                        { title: "Хэмжих нэгж", dataIndex: "usize", key: "usize", width: "10%" },
                        {
                            title: "Үнэ",
                            dataIndex: "price",
                            key: "price",
                            width: "10%",
                            render: (v) => Number(v).toLocaleString(),
                        },
                        {
                            title: "Нийт дүн",
                            dataIndex: "pricesum",
                            key: "pricesum",
                            width: "15%",
                            render: (v) => Number(v).toLocaleString(),
                        },
                    ]}
                    dataSource={record.items}
                    pagination={false}
                    rowKey={(item, idx) => `${record.key}-${idx}`}
                    scroll={{ x: true }}
                />
            ),
        },
        {
            title: "План / Тех",
            key: "plantech",
            width: "8%",
            render: (_, record) => (
                <>
                    {record.planurl && (
                        <Button
                            type="link"
                            onClick={() =>
                                window.open(`${PLAN_BASE_URL}${record.planurl}`, "_blank")
                            }
                        >
                            План үзэх
                        </Button>
                    )}
                    {record.techurl && (
                        <Button
                            type="link"
                            onClick={() =>
                                window.open(`${TECH_BASE_URL}${record.techurl}`, "_blank")
                            }
                        >
                            Тех/Д үзэх
                        </Button>
                    )}
                </>
            ),
        },
        {
            title: "Үйлдэл",
            key: "action",
            width: "8%",
            render: (_, record) =>
                user?.erh === "Удирдлага" ? null : (
                    <Space>
                        <Popconfirm
                            title="Устгахдаа итгэлтэй байна уу?"
                            onConfirm={() => handleDelete(record.pkgno, record.pkgdate)}
                            okText="Тийм"
                            cancelText="Үгүй"
                        >
                            <Button danger size="small">
                                🗑️ Устгах
                            </Button>
                        </Popconfirm>
                    </Space>
                ),
        },
    ];

    const filteredColumns =
        user?.erh === "Удирдлага"
            ? columns.filter((col) => col.key !== "action")
            : columns;

    return (
        <Table
            rowSelection={rowSelection}
            columns={filteredColumns}
            dataSource={groupedData}
            rowKey="key"
            pagination={{ pageSize: 5 }}
            bordered
        />
    );
};

export default ТөлөвлөгөөItemDetails;
