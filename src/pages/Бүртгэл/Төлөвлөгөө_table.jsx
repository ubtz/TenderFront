import React, { useEffect, useState } from "react";
import { Table, Input, Button, Space, Modal, message, Checkbox } from "antd";
import axios from "axios";
import Highlighter from "react-highlight-words";
import Tablez from "./Table";
import { DeleteOutlined } from "@ant-design/icons";
import PrintIcon from "./PrintIcon"; // Adjust the import path as needed
import BasketItemsDetails from "./BasketItemsDetails";
import ТөлөвлөгөөItemDetails from "./ТөлөвлөгөөItemDetails";
import { useMemo } from "react";

function ТөлөвлөгөөTable() {
    const [data, setData] = useState([]);
    const [searchText, setSearchText] = useState("");
    const [columnFilters, setColumnFilters] = useState({});

    const API_BASE_URL = import.meta.env.VITE_API_URL;
    const [modalVisible, setModalVisible] = useState(false);
    const [currentRecord, setCurrentRecord] = useState(null);
    const [tenderNumber, setTenderNumber] = useState("");
    const [selectedBaskets, setSelectedBaskets] = useState([]);

    const userJson = localStorage.getItem("data");
    const user = userJson ? JSON.parse(userJson) : null;
    console.log("User in ТөлөвлөгөөTable:", user);
    const [usersinfo, setUsers] = useState([]);
    const [userinfo, setUser] = useState(null); // currently logged-in user
    const [expandedRowKeys, setExpandedRowKeys] = useState([]);
    const [expandedBasketKeys, setExpandedBasketKeys] = useState([]);
    const [lockedBasketIds, setLockedBasketIds] = useState([]);
    const [basketTenderMap, setBasketTenderMap] = useState({});

    useEffect(() => {
        // get logged-in user (from localStorage, etc.)
        const storedUser = JSON.parse(localStorage.getItem("data"));
        setUser(storedUser);

        // fetch all users info
        axios
            .get(API_BASE_URL + "/get/GetUsers")
            .then((res) => {
                setUsers(res.data || []);
            })
            .catch((err) => {
                console.error("❌ Error fetching users:", err);
            });
    }, []);

    // helper to get username or name by id
    const getUsernameById = (id) => {
        const u = usersinfo.find((usr) => usr.id === id || usr.user_id === id);
        // console.log("Getting username for ID:", id, "=>", u);
        // console.log("Getting username for ID:", usersinfo, id);
        if (!u) return "—";

        // Prefer username if available, otherwise fallback to full name
        return u.username?.trim()
            ? u.username
            : `${u.ovog || ""} ${u.ner || ""}`.trim() || "—";
    };
    // Open modal
    const handleCreateTender = async (record) => {
        setCurrentRecord(record);
        setTenderNumber("");
        setSelectedBaskets([]);
        setLockedBasketIds([]); // reset


        try {
            const res = await axios.get(
                `${API_BASE_URL}/get/GetBasketIdsByRootNum/${record.plan_root_number}`
            );
            setBasketTenderMap(res.data?.basketTenderMap || {});
            setLockedBasketIds(res.data?.basketIds || []);
        } catch (err) {
            console.error("❌ Failed to load locked baskets:", err);
        }

        setModalVisible(true);
    };


    // Save tender
    const handleSaveTender = async () => {
        if (!tenderNumber) {
            message.warning("Тендерийн дугаар оруулна уу!");
            return;
        }

        if (selectedBaskets.length === 0) {
            message.warning("Багц сонгоно уу!");
            return;
        }

        const invalid = selectedBaskets.some(
            id => lockedBasketIds.includes(id)
        );

        if (invalid) {
            message.error("Зарим багц аль хэдийн тендерт орсон байна!");
            return;
        }
        console.log("selectedBaskets:", selectedBaskets);
        if (!tenderNumber) {
            message.warning("Тендерийн дугаар оруулна уу!");
            return;
        }
        try {
            const organization = [
                ...new Set(
                    currentRecord.baskets.flatMap(basket =>
                        basket.items.map(item => item.dname)
                    )
                )
            ].join(", ");
            await axios.post(`${API_BASE_URL}/post/PostTender`, {
                plan_root_number: currentRecord.plan_root_number,
                тендерийн_дугаар: tenderNumber,
                tender_name: currentRecord.plan_name,
                Organization: organization,
                Basket_Ids: selectedBaskets.join(","),
                CreatedBy: user.id,
            });
            console.log("✅ Organization:", organization);
            message.success("✅ Тендер үүсгэгдлээ");
            setModalVisible(false);
            setTenderNumber("");
            setCurrentRecord(null);
        } catch (err) {
            console.error("❌ Failed to create tender:", err);
            message.error("Тендер үүсгэхэд алдаа гарлаа");
        }
    };
    // Calculate new_pricesum automatically
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);

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
                const allPlans = response.data || [];

                // ✅ Filter by logged-in user
                const filteredPlans =
                    user?.erh === "Удирдлага"
                        ? allPlans
                        : allPlans.filter((plan) => plan.user_id === user.id);

                const transformed = filteredPlans
                    .sort((a, b) => a.plan_name.localeCompare(b.plan_name)) // ✅ Sort by plan name
                    .map((planGroup, index) => {
                        const baskets = planGroup.baskets.map((basket) => ({
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
                            is_Valid: basket.is_valid,
                        }));

                        const planTotal = baskets.reduce((acc, b) => acc + b.total_price, 0);

                        return {
                            key: `plan-${planGroup.plan_root_number}-${index}`,
                            index: index + 1,
                            plan_root_number: planGroup.plan_root_number,
                            plan_name: planGroup.plan_name,
                            user_id: planGroup.user_id,
                            baskets,
                            total_price: planTotal,
                        };
                    });

                setData(transformed);
                // setFilteredData(transformed);
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
    const filteredData = useMemo(() => {
        let result = data;

        // ✅ Global search
        if (searchText) {
            const lower = searchText.toLowerCase();
            result = result
                .map((plan) => {
                    const filteredBaskets = plan.baskets
                        .map((basket) => {
                            const filteredItems = basket.items.filter((item) =>
                                Object.values(item).some(
                                    (val) =>
                                        val &&
                                        val.toString().toLowerCase().includes(lower)
                                )
                            );
                            const basketMatch = Object.values(basket).some(
                                (val) =>
                                    val &&
                                    val.toString().toLowerCase().includes(lower)
                            );
                            if (filteredItems.length > 0 || basketMatch) {
                                return { ...basket, items: filteredItems };
                            }
                            return null;
                        })
                        .filter(Boolean);

                    const planMatch = Object.values(plan).some(
                        (val) =>
                            val &&
                            val.toString().toLowerCase().includes(lower)
                    );

                    if (filteredBaskets.length > 0 || planMatch) {
                        return { ...plan, baskets: filteredBaskets };
                    }
                    return null;
                })
                .filter(Boolean);
        }

        Object.keys(columnFilters).forEach((key) => {
            const value = columnFilters[key]?.toLowerCase?.() || "";
            if (!value) return;

            result = result.filter((plan) => {
                // 🧠 Special handling for user_id column
                if (key === "user_id") {
                    const username = getUsernameById(plan.user_id)?.toLowerCase?.() || "";
                    return username.includes(value);
                }

                // Default behavior for other columns
                return (plan[key] || "").toString().toLowerCase().includes(value);
            });
        });


        return result;
    }, [data, searchText, columnFilters]);


    const renderColumnHeaderWithSearch = (title, dataIndex) => (
        <div
            style={{ display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()} // 🛑 prevent sort when clicking input
        >
            <span style={{ fontWeight: 600 }}>{title}</span>
            <Input
                placeholder="Хайх..."
                allowClear
                size="small"
                value={columnFilters[dataIndex] || ""}
                onClick={(e) => e.stopPropagation()}   // 🛑 prevent sorting
                onFocus={(e) => e.stopPropagation()}   // 🛑 extra safety
                onChange={(e) =>
                    setColumnFilters((prev) => ({
                        ...prev,
                        [dataIndex]: e.target.value,
                    }))
                }
                style={{ marginTop: 4 }}
            />
        </div>
    );

    // -------------------- Columns --------------------
    const planColumns = [
        {
            title: renderColumnHeaderWithSearch("Төлөвлөгөө нэр", "plan_name"),
            dataIndex: "plan_name",
            key: "plan_name",
            width: 350, // ✅ fixed width
            ellipsis: true, // ✅ prevent text overflow
            sorter: (a, b) => a.plan_name.localeCompare(b.plan_name),
            sortDirections: ["ascend", "descend"],
        },
        {
            title: renderColumnHeaderWithSearch("Нийт мөнгөн дүн, Төг", "total_price"),
            dataIndex: "total_price",
            key: "total_price",
            width: 130, // ✅ fixed width
            align: "right",
            sorter: (a, b) => a.total_price - b.total_price,
            render: (value) => Number(value).toLocaleString(),
        },
        {
            title:
                userinfo?.erh === "Удирдлага" || userinfo?.Erh === "Удирдлага"
                    ? renderColumnHeaderWithSearch("Хариуцагч", "user_id")
                    : "Хариуцагч",
            key: "action",
            width: 150, // ✅ fixed width
            ellipsis: true,
            render: (_, record) => {
                const isValid = record.baskets[0]?.is_valid ?? false;

                if (userinfo?.erh === "Удирдлага" || userinfo?.Erh === "Удирдлага") {
                    return (
                        <span
                            style={{
                                color: "#555",
                                fontSize: 13,
                                display: "inline-block",
                                maxWidth: "200px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            👤 {getUsernameById(record.user_id)}
                        </span>
                    );
                }

                return (
                    <Space>
                        <Button
                            type="primary"
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCreateTender(record);
                            }}
                        >
                            Тендер үүсгэх
                        </Button>
                    </Space>
                );
            },
        },
        {
            title: "",
            key: "print",
            fixed: "right",
            width: 80, // ✅ smaller width for icon
            align: "center",
            render: (_, row) => (
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: "pointer" }}
                >
                    <PrintIcon
                        normData={row}
                        planId={row.plan_root_number}
                        UserId={row.user_id}
                    />
                </div>
            ),
        },
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


    // -------------------- Expanded Rows --------------------
    const basketExpandedRowRender = (basket) => (
        console.log("Rendering basket:", basket) || (
            <ТөлөвлөгөөItemDetails data={basket.items || []} />
        )
    );

    const planExpandedRowRender = (plan) => (
        <Table
            columns={basketColumns}
            dataSource={plan?.baskets || []}
            bordered
            pagination={false}
            size="small"
            expandable={{
                expandedRowRender: basketExpandedRowRender,
                rowExpandable: (record) => record.items?.length > 0,
                expandedRowKeys: expandedBasketKeys,
                onExpand: (expanded, record) => {
                    setExpandedBasketKeys((prev) =>
                        expanded
                            ? [...prev, record.basket_id]
                            : prev.filter((k) => k !== record.basket_id)
                    );
                },
            }}
            onRow={(record) => ({
                onClick: () => {
                    setExpandedBasketKeys((prev) =>
                        prev.includes(record.basket_id)
                            ? prev.filter((k) => k !== record.basket_id)
                            : [...prev, record.basket_id]
                    );
                },
                // ✅ Highlight basket row when expanded
                className: expandedBasketKeys.includes(record.basket_id)
                    ? "expanded-row"
                    : "",
            })}
            rowKey="basket_id"
        />
    );


    return (
        <>
            <Table
                columns={planColumns}
                dataSource={filteredData}
                bordered
                pagination={{ pageSize: 5 }}
                tableLayout="fixed" // ✅ lock column widths
                scroll={{ x: "100%" }} // ✅ enable horizontal scroll if needed

                expandable={{
                    expandedRowRender: planExpandedRowRender,
                    rowExpandable: (record) => record.baskets?.length > 0,
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
                    onClick: () => {
                        setExpandedRowKeys((prev) =>
                            prev.includes(record.key)
                                ? prev.filter((k) => k !== record.key)
                                : [...prev, record.key]
                        );
                    },
                    // ✅ Highlight active expanded row
                    className: expandedRowKeys.includes(record.key) ? "expanded-row" : "",
                })}
            />


            <Modal
                title="Тендер үүсгэх"
                open={modalVisible}
                onOk={handleSaveTender}
                onCancel={() => setModalVisible(false)}
            >
                <Input
                    placeholder="Тендерийн дугаар оруулах"
                    value={tenderNumber}
                    onChange={(e) => setTenderNumber(e.target.value)}
                    style={{ marginBottom: 16 }}
                />

                <Checkbox.Group
                    style={{ display: "flex", flexDirection: "column" }}
                    value={selectedBaskets}
                    onChange={(checkedValues) => setSelectedBaskets(checkedValues)}
                >
                    {currentRecord?.baskets?.map((b) => (
                        <Checkbox
                            key={b.basket_id}
                            value={b.basket_id}
                            disabled={lockedBasketIds.includes(b.basket_id)}
                        >
                            {b.basket_name} — {b.total_price?.toLocaleString()}₮

                            {lockedBasketIds.includes(b.basket_id) && (
                                <span style={{ color: "red", marginLeft: 8 }}>
                                    (Тендерт орсон: {basketTenderMap[b.basket_id]})
                                </span>
                            )}
                        </Checkbox>
                    ))}
                </Checkbox.Group>
            </Modal>
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

export default ТөлөвлөгөөTable;
