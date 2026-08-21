import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Modal,
    Table,
    Button,
    Space,
    Spin,
    message,
    Input,
    Card,
    Tree,
    Tooltip,
    Popconfirm,
    Empty,
    Tag,
    Typography,
    Segmented,
} from "antd";
import {
    ExclamationCircleOutlined,
    FolderOpenOutlined,
    FolderOutlined,
    FileOutlined,
    PlusCircleOutlined,
    MinusCircleOutlined,
    EditOutlined,
    CheckOutlined,
    CloseOutlined,
    ReloadOutlined,
    CalendarOutlined,
    SearchOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import PropTypes from "prop-types";
import { updateOrderStatus } from "../../api/orders";
import { createBasketItemPayload, getOrderIdentity } from "./order.utils";

const { Text } = Typography;
const basketYears = ["2025", "2026", "2027"];
const toNumber = (value) => Number(String(value ?? "").replace(/,/g, "")) || 0;
const calculateItemTotal = (item) => toNumber(item.price) * toNumber(item.qty);
const getBasketYear = (basket) => {
    const value = basket.publish_date || basket.set_date || basket.added_at;
    const match = String(value || "").match(/^(\d{4})/);
    return match?.[1] || "";
};
const createPlanRootNumber = () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return 1_000_000_000 + (values[0] % 1_000_000_000);
};

const MyModalWithTable = ({
    visible,
    setVisible,
    selectedRows,
    removeInsertedRows,
    onInserted,   // ✅ new callback
}) => {
    // --- config & user
    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("data") || "{}");
        } catch {
            return {};
        }
    }, []);
    const API_BASE_URL = import.meta.env.VITE_API_URL;

    // --- state
    const [treeData, setTreeData] = useState([]);
    const [expandedKeys, setExpandedKeys] = useState([]);
    const [editingKey, setEditingKey] = useState(null);
    const [editingValue, setEditingValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [treeSearch, setTreeSearch] = useState("");
    const [activeBasketYear, setActiveBasketYear] = useState("all");
    // --- helpers
    // --- fetch baskets and build tree (group by plan_root_number -> basket_type -> baskets)
    const fetchTreeData = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/get/basket`);
            const allData = res.data || [];
            const userData = allData.filter(
                (basket) => String(basket.user_id) === String(user.id) && !basket.is_temp
            );

            const plans = {};
            userData.forEach((item) => {
                const planKey = item.plan_root_number ?? `unassigned-${item.plan_name || item.basket_id}`;
                if (!plans[planKey]) {
                    plans[planKey] = {
                        key: `plan-${planKey}`,
                        title: item.plan_name || `План ${planKey}`,
                        type: "plan",
                        plan_root_number: item.plan_root_number,
                        icon: <FolderOpenOutlined style={{ color: "#1677ff" }} />,
                        childrenMap: {},
                    };
                }
                const plan = plans[planKey];

                const typeKey = item.basket_type || "Ерөнхий";
                if (!plan.childrenMap[typeKey]) {
                    plan.childrenMap[typeKey] = {
                        key: `type-${planKey}-${typeKey}`,
                        title: item.basket_type || typeKey,
                        type: "type",
                        plan_root_number: item.plan_root_number,
                        plan_name: item.plan_name,
                        basket_type: item.basket_type,
                        icon: <FolderOutlined style={{ color: "#52c41a" }} />,
                        children: [],
                    };
                }

                plan.childrenMap[typeKey].children.push({
                    key: `basket-${item.basket_id}`,
                    title: (item.basket_name || "Шинэ багц").trim(),
                    name: (item.basket_name || "Шинэ багц").trim(),
                    type: "basket",
                    basket_id: item.basket_id,
                    plan_root_number: item.plan_root_number,
                    basket_type: item.basket_type,
                    year: getBasketYear(item),
                    icon: <FileOutlined />,
                    raw: item,
                });
            });

            const structured = Object.values(plans).map((p) => ({
                ...p,
                children: Object.values(p.childrenMap),
            }));

            // After building structured = Object.values(plans).map(...)
            setTreeData(structured);

            setExpandedKeys(structured.map((node) => node.key));

        } catch (err) {
            console.error("❌ fetchTreeData:", err);
            message.error("Мэдээлэл татахад алдаа гарлаа!");
        } finally {
            setLoading(false);
        }
    }, [API_BASE_URL, user?.id]);

    // fetch when modal opens
    useEffect(() => {
        if (visible) fetchTreeData();
        else {
            setTreeData([]);
            setExpandedKeys([]);
            setTreeSearch("");
            setActiveBasketYear("all");
            setEditingKey(null);
            setEditingValue("");
        }
    }, [visible, fetchTreeData]);

    // --- flatten items helper for confirmation table
    const getFlattenedSelected = useCallback(() => selectedRows.flatMap((r) => r.items || [r]), [selectedRows]);
    const selectedSummary = useMemo(() => {
        const items = selectedRows.flatMap((row) => row.items || [row]);
        return {
            itemCount: items.length,
            packageCount: new Set(items.map((item) => `${item.pkgno}-${item.pkgdate}`)).size,
            totalPrice: items.reduce((sum, item) => sum + calculateItemTotal(item), 0),
        };
    }, [selectedRows]);

    // --- INSERT logic (same as your previous handleConfirmInsert)
    const handleConfirmInsert = useCallback(
        async (basketRecord) => {
            if (!selectedRows?.length) {
                message.warning("Нэмэх өгөгдөл сонгоно уу!");
                return;
            }

            setLoading(true);
            const hideMsg = message.loading("Өгөгдөл илгээж байна...");
            try {
                // Step 1: unique pkg pairs
                const items = selectedRows.flatMap((row) => row.items || [row]);
                const pkgPairs = items
                    .filter((item) => item.pkgno && item.pkgdate)
                    .map((item) => ({ pkgno: item.pkgno, pkgdate: item.pkgdate }));
                const uniquePkgPairs = Array.from(
                    new Map(pkgPairs.map((p) => [`${p.pkgno}_${p.pkgdate}`, p])).values()
                );

                // Step 2: send inserts in batches
                const batchSize = 30;
                const insertedItems = [];
                const failedItems = [];
                const persistedTempItems = items.every((item) => item.basketItemId);

                if (persistedTempItems) {
                    const moveResponse = await axios.put(`${API_BASE_URL}/put/MoveBasketItems`, {
                        basket_item_ids: items.map((item) => item.basketItemId),
                        target_basket_id: basketRecord.basket_id,
                        user_id: user.id,
                    });
                    if (Number(moveResponse.data?.moved_count) !== items.length) {
                        throw new Error("Selected basket items were not moved completely");
                    }
                    insertedItems.push(...items);
                } else {
                    for (let i = 0; i < items.length; i += batchSize) {
                        const batch = items.slice(i, i + batchSize);
                        const results = await Promise.allSettled(
                            batch.map((item) =>
                                axios.post(
                                    `${API_BASE_URL}/post/PostBasketItems`,
                                    createBasketItemPayload(item, basketRecord.basket_id)
                                )
                            )
                        );

                        results.forEach((result, resultIndex) => {
                            const item = batch[resultIndex];
                            if (result.status === "fulfilled") insertedItems.push(item);
                            else failedItems.push(item);
                        });
                    }
                }

                if (!insertedItems.length) {
                    throw new Error("No basket items were inserted");
                }

                // Step 3: status updates
                const failedPackageKeys = new Set(
                    failedItems.map((item) => `${item.pkgno}_${item.pkgdate}`)
                );
                const completedPkgPairs = uniquePkgPairs.filter(
                    ({ pkgno, pkgdate }) => !failedPackageKeys.has(`${pkgno}_${pkgdate}`)
                );
                const statusResults = await Promise.allSettled(
                    completedPkgPairs.map(({ pkgno, pkgdate }) =>
                        updateOrderStatus(pkgno, pkgdate, "2")
                    )
                );
                const failedStatusCount = statusResults.filter(
                    (result) => result.status === "rejected"
                ).length;

                // Step 4: success & cleanup
                removeInsertedRows(insertedItems);
                await fetchTreeData();
                if (typeof onInserted === "function") await onInserted();

                if (failedItems.length || failedStatusCount) {
                    message.warning(
                        `${insertedItems.length} мөр нэмэгдсэн, ${failedItems.length} мөр амжилтгүй, ${failedStatusCount} статус шинэчлэгдсэнгүй.`
                    );
                } else {
                    message.success(
                        `✅ ${insertedItems.length} мөр амжилттай нэмэгдлээ (${completedPkgPairs.length} статус илгээгдлээ).`
                    );
                    setVisible(false);
                }
            } catch (err) {
                console.error("❌ Insert error:", err);
                message.error("⚠️ Зарим өгөгдлийг илгээхэд алдаа гарлаа!");
            } finally {
                hideMsg();
                setLoading(false);
            }
        },
        [API_BASE_URL, selectedRows, removeInsertedRows, fetchTreeData, onInserted, setVisible, user.id]
    );

    // --- When user clicks a basket node: show confirmation table then insert
    const handleClickBasket = useCallback(
        (basketNode) => {
            const flattened = getFlattenedSelected();
            if (!flattened.length) {
                message.warning("Нэмэх өгөгдөл сонгоно уу!");
                return;
            }
            const packageCount = new Set(
                flattened.map((item) => `${item.pkgno}-${item.pkgdate}`)
            ).size;
            const totalPrice = flattened.reduce(
                (sum, item) => sum + calculateItemTotal(item),
                0
            );
            const confirmationRows = flattened.map((item, index) => ({
                ...item,
                confirmationKey: `confirm-${item.basketItemId || item.reactKey || getOrderIdentity(item)}-${index}`,
            }));
            const basketName = basketNode.name || basketNode.raw?.basket_name || "Сонгосон багц";
            Modal.confirm({
                title: `“${String(basketName).trim()}” багцад оруулах`,
                icon: <ExclamationCircleOutlined />,
                width: 1050,
                centered: true,
                content: (
                    <div>
                        <Space wrap style={{ marginBottom: 12 }}>
                            <Tag>{packageCount} багц</Tag>
                            <Tag>{flattened.length} захиалга</Tag>
                            <Tag color="green">{totalPrice.toLocaleString()} ₮</Tag>
                        </Space>
                        <Table
                            dataSource={confirmationRows}
                            columns={[
                                { title: "Барааны нэр", dataIndex: "cr4name", width: 220, ellipsis: true },
                                { title: "Марк", dataIndex: "crmarkname", width: 160, ellipsis: true },
                                { title: "Зургийн №", dataIndex: "zno", width: 110, ellipsis: true },
                                { title: "Нэгж", dataIndex: "usize", width: 90 },
                                { title: "Хэмжих нэгж", dataIndex: "mname", width: 110 },
                                {
                                    title: "Тоо",
                                    dataIndex: "qty",
                                    width: 90,
                                    align: "right",
                                    render: (value) => toNumber(value).toLocaleString(),
                                },
                                {
                                    title: "Нэгж үнэ",
                                    dataIndex: "price",
                                    width: 130,
                                    align: "right",
                                    render: (value) => `${toNumber(value).toLocaleString()} ₮`,
                                },
                                {
                                    title: "Нийт үнэ",
                                    key: "totalPrice",
                                    width: 145,
                                    align: "right",
                                    render: (_, item) => (
                                        <Text strong>{calculateItemTotal(item).toLocaleString()} ₮</Text>
                                    ),
                                },
                            ]}
                            pagination={flattened.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
                            size="small"
                            scroll={{ x: 1050, y: 360 }}
                            rowKey="confirmationKey"
                        />
                    </div>
                ),
                okText: "Багцад оруулах",
                cancelText: "Болих",
                onOk: () => handleConfirmInsert(basketNode.raw || basketNode),
            });
        },
        [getFlattenedSelected, handleConfirmInsert]
    );

    // --- TREE add / post basket (reusing previous payload shapes)
    const postBasket = useCallback(
        async (payload) => {
            if (!user?.id) {
                message.warning("Хэрэглэгч олдсонгүй");
                return;
            }
            try {
                setLoading(true);
                const full = {
                    ...payload,
                    userId: user.id,
                };
                await axios.post(`${API_BASE_URL}/post/addBasket`, full);
                message.success("✅ Амжилттай нэмэгдлээ!");
                await fetchTreeData();
            } catch (err) {
                console.error("❌ postBasket:", err);
                const backendMsg =
                    err?.response?.data?.error ||
                    err?.response?.data?.message ||
                    "Багц нэмэхэд алдаа гарлаа!";
                message.error(backendMsg);
            } finally {
                setLoading(false);
            }
        },
        [API_BASE_URL, fetchTreeData, user?.id]
    );

    const handleAddNode = useCallback(
        async (node) => {
            const today = dayjs().format("YYYY-MM-DD");
            const nextWeek = dayjs().add(7, "day").format("YYYY-MM-DD");

            if (!node) {
                // add plan
                const payload = {
                    planName: "Шинэ төлөвлөгөө",
                    planRootNumber: createPlanRootNumber(),
                    basketType: "Ангилал",
                    basketName: "Багц",
                    basketNumber: 1,
                    publishDate: today,
                    setDate: nextWeek,
                };
                await postBasket(payload);
                return;
            }

            if (node.type === "plan") {
                const payload = {
                    planName: node.title,
                    planRootNumber: node.plan_root_number,
                    basketType: "Ангилал",
                    basketName: "Шинэ багц",
                    basketNumber: 1,
                    publishDate: today,
                    setDate: nextWeek,
                };
                await postBasket(payload);
                return;
            }

            if (node.type === "type") {

                const payload = {
                    planName: node.plan_name,
                    planRootNumber: node.plan_root_number,
                    basketType: node.basket_type,
                    basketName: "Шинэ багц",
                    basketNumber: 1,
                    publishDate: today,
                    setDate: nextWeek,
                };
                await postBasket(payload);
                return;
            }
        },
        [postBasket]
    );
    // --- delete node (plan/type/basket)
    const deleteNode = useCallback(
        async (node) => {
            if (!user?.id) return;

            try {
                // 🔹 Fetch all basket items once
                const res = await axios.get(`${API_BASE_URL}/get/Items`);
                const items = res.data || [];

                let hasItems = false;
                let totalCount = 0;

                // 🧩 1️⃣ Check based on node type
                if (node.type === "basket") {
                    const basketItems = items.filter(
                        (item) => String(item.basketId) === String(node.basket_id)
                    );
                    hasItems = basketItems.length > 0;
                    totalCount = basketItems.length;
                }
                else if (node.type === "type") {
                    // find all basket IDs belonging to this type
                    const allTypeBaskets = treeData
                        .flatMap((p) => p.children || [])
                        .find((t) => t.key === node.key)?.children || [];

                    const basketIds = allTypeBaskets.map((b) => b.basket_id);
                    const typeItems = items.filter((item) =>
                        basketIds.some((basketId) => String(basketId) === String(item.basketId))
                    );
                    hasItems = typeItems.length > 0;
                    totalCount = typeItems.length;
                }
                else if (node.type === "plan") {
                    // find all basket IDs under this plan
                    const planNode = treeData.find((p) => p.key === node.key);
                    const allBasketIds = [];
                    planNode?.children?.forEach((typeNode) => {
                        typeNode.children?.forEach((b) => allBasketIds.push(b.basket_id));
                    });

                    const planItems = items.filter((item) =>
                        allBasketIds.some((basketId) => String(basketId) === String(item.basketId))
                    );
                    hasItems = planItems.length > 0;
                    totalCount = planItems.length;
                }

                if (hasItems) {
                    message.warning(
                        `⚠️ "${node.title}" дотор ${totalCount} өгөгдөл байна. Устгахын тулд эхлээд доторх багцуудыг хоосолно уу.`
                    );
                    return; // ❌ stop deletion
                }
            } catch (checkErr) {
                console.error("⚠️ Item check failed:", checkErr);
                message.error("Багцын өгөгдлийг шалгахад алдаа гарлаа!");
                return;
            }

            // 🧾 Build payload for delete
            let payload = { user_id: user.id };
            if (node.type === "plan") payload.plan_root_number = node.plan_root_number;
            else if (node.type === "type") {
                payload.plan_root_number = node.plan_root_number;
                payload.basket_type = node.basket_type;
            } else if (node.type === "basket") payload.basket_id = node.basket_id;

            try {
                setLoading(true);
                const res = await axios.delete(`${API_BASE_URL}/delete/deleteBasket`, {
                    data: payload,
                    headers: { "Content-Type": "application/json" },
                });
                message.success(res?.data?.message || "Амжилттай устгагдлаа!");
                await fetchTreeData();
            } catch (err) {
                console.error("❌ deleteNode:", err);
                const backendMsg =
                    err?.response?.data?.error ||
                    err?.response?.data?.message ||
                    "Устгах үед алдаа гарлаа!";
                message.error(backendMsg);
            } finally {
                setLoading(false);
            }
        },
        [API_BASE_URL, fetchTreeData, user?.id, treeData]
    );

    // --- rename
    const startEditing = useCallback((node) => {
        setEditingKey(node.key);
        setEditingValue(node.title);
    }, []);

    const saveEditing = useCallback(
        async (node) => {
            if (!editingValue.trim()) return;
            const newName = editingValue.trim();
            const payload = { user_id: user.id };

            if (node.type === "plan") {
                payload.plan_root_number = node.plan_root_number;
                payload.new_plan_name = newName;
            } else if (node.type === "type") {
                payload.plan_root_number = node.plan_root_number;
                payload.basket_type = node.basket_type;
                payload.new_type_name = newName;
            } else if (node.type === "basket") {
                payload.basket_id = node.basket_id;
                payload.new_basket_name = newName;
            }

            try {
                setLoading(true);
                const res = await axios.put(`${API_BASE_URL}/put/UpdateBasket`, payload, {
                    headers: { "Content-Type": "application/json" },
                });
                if (res?.data?.message) message.success(`✏️ ${res.data.message}`);
                else message.success("✅ Амжилттай нэр өөрчлөгдлөө!");

                // local update to show change immediately
                const renameRecursive = (list) =>
                    list.map((item) => {
                        if (item.key === node.key) return { ...item, title: newName };
                        if (item.children) return { ...item, children: renameRecursive(item.children) };
                        return item;
                    });

                setTreeData((prev) => renameRecursive(prev));
                setEditingKey(null);
                setEditingValue("");
            } catch (err) {
                console.error("❌ saveEditing:", err);
                const backendMsg =
                    err?.response?.data?.error ||
                    err?.response?.data?.message ||
                    "Нэр өөрчлөх үед алдаа гарлаа!";
                message.error(`⚠️ ${backendMsg}`);
            } finally {
                setLoading(false);
            }
        },
        [API_BASE_URL, editingValue, user?.id]
    );

    const cancelEditing = useCallback(() => {
        setEditingKey(null);
        setEditingValue("");
    }, []);

    // --- utilities for rendering tree title with actions
    const handleNodeAction = useCallback((node) => {
        if (node.type === "basket") {
            handleClickBasket(node);
            return;
        }

        const isExpanded = expandedKeys.includes(node.key);
        if (isExpanded) setExpandedKeys((prev) => prev.filter((k) => k !== node.key));
        else setExpandedKeys((prev) => [...prev, node.key]);
    }, [expandedKeys, handleClickBasket]);

    const handleTreeSelect = useCallback((_, info) => {
        if (!info?.node) return;
        handleNodeAction(info.node);
    }, [handleNodeAction]);

    const renderTitle = useCallback(
        (node) => (
            <div
                className={`basket-picker-node basket-picker-node--${node.type}`}
            >
                {editingKey === node.key ? (
                    <>
                        <Input
                            size="small"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 160 }}
                        />
                        <Button
                            size="small"
                            type="link"
                            icon={<CheckOutlined />}
                            onClick={(e) => {
                                e.stopPropagation();
                                saveEditing(node);
                            }}
                        />
                        <Button
                            size="small"
                            type="link"
                            icon={<CloseOutlined />}
                            onClick={(e) => {
                                e.stopPropagation();
                                cancelEditing();
                            }}
                        />
                    </>
                ) : (
                    <>
                        <span className="basket-picker-node__title">
                            {node.title}
                        </span>

                        {node.type === "basket" && (
                            <>
                                {node.year && <Tag bordered={false}>{node.year}</Tag>}
                                <Tag bordered={false} color="green">Сонгох</Tag>
                            </>
                        )}

                        <Tooltip title="Нэр өөрчлөх">
                            <Button
                                size="small"
                                type="link"
                                icon={<EditOutlined />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(node);
                                }}
                            />
                        </Tooltip>

                        {node.type !== "basket" && (
                            <Tooltip title="Нэмэх">
                                <Button
                                    size="small"
                                    type="link"
                                    icon={<PlusCircleOutlined />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddNode(node);
                                    }}
                                />
                            </Tooltip>
                        )}

                        <Tooltip title="Устгах">
                            <Popconfirm
                                title="Устгах уу?"
                                okText="Тийм"
                                cancelText="Үгүй"
                                onConfirm={(e) => {
                                    e.stopPropagation();
                                    deleteNode(node);
                                }}
                            >
                                <Button
                                    size="small"
                                    type="link"
                                    icon={<MinusCircleOutlined />}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </Popconfirm>
                        </Tooltip>
                    </>
                )}
            </div>
        ),
        [
            editingKey,
            editingValue,
            saveEditing,
            cancelEditing,
            startEditing,
            handleAddNode,
            deleteNode,
        ]
    );

    const decorateTree = useCallback(
        (list) =>
            list.map((item) => ({
                ...item,
                title: renderTitle(item),
                children: item.children ? decorateTree(item.children) : [],
            })),
        [renderTitle]
    );

    const filteredTreeData = useMemo(() => {
        const query = treeSearch.trim().toLocaleLowerCase();

        const filterNodes = (nodes) => nodes.flatMap((node) => {
            const children = filterNodes(node.children || []);
            if (node.type === "basket" && activeBasketYear !== "all" && node.year !== activeBasketYear) {
                return [];
            }
            const matches = String(node.title || "").toLocaleLowerCase().includes(query);
            if (node.type === "basket") return !query || matches ? [{ ...node, children }] : [];
            if (activeBasketYear !== "all" && !children.length) return [];
            return !query || matches || children.length ? [{ ...node, children }] : [];
        });

        return filterNodes(treeData);
    }, [activeBasketYear, treeData, treeSearch]);

    const filteredBasketCount = useMemo(() => {
        let count = 0;
        const visit = (nodes) => nodes.forEach((node) => {
            if (node.type === "basket") count += 1;
            visit(node.children || []);
        });
        visit(filteredTreeData);
        return count;
    }, [filteredTreeData]);

    useEffect(() => {
        if (!treeSearch.trim()) return;
        const keys = [];
        const collectKeys = (nodes) => nodes.forEach((node) => {
            keys.push(node.key);
            collectKeys(node.children || []);
        });
        collectKeys(filteredTreeData);
        setExpandedKeys(keys);
    }, [filteredTreeData, treeSearch]);

    return (
        <>
            {/* Main modal shows tree */}
            <Modal
                title={(
                    <div className="basket-picker-title">
                        <div className="basket-picker-title__icon"><FolderOpenOutlined /></div>
                        <div>
                            <div className="basket-picker-title__text">Багц сонгох</div>
                            <div className="basket-picker-title__subtitle">Сонгосон захиалгыг оруулах төлөвлөгөө, багцаа сонгоно уу</div>
                        </div>
                    </div>
                )}
                open={visible}
                onCancel={() => setVisible(false)}
                footer={null}
                width={1040}
                centered
                className="basket-picker-modal"
                getContainer={false}
                destroyOnHidden
            >
                <div className="basket-picker-summary">
                    <div className="basket-picker-summary__item"><span>Сонгосон багц</span><strong>{selectedSummary.packageCount}</strong></div>
                    <div className="basket-picker-summary__item"><span>Захиалга</span><strong>{selectedSummary.itemCount}</strong></div>
                    <div className="basket-picker-summary__item basket-picker-summary__item--amount"><span>Нийт дүн</span><strong>{selectedSummary.totalPrice.toLocaleString()} ₮</strong></div>
                </div>

                <div className="basket-picker-toolbar">
                    <Input
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder="Төлөвлөгөө, ангилал, багц хайх..."
                        value={treeSearch}
                        onChange={(event) => setTreeSearch(event.target.value)}
                        className="basket-picker-search"
                    />
                    <div className="basket-picker-year-filter">
                        <span><CalendarOutlined /> Он</span>
                        <Segmented
                            value={activeBasketYear}
                            onChange={setActiveBasketYear}
                            options={[
                                { label: "Бүгд", value: "all" },
                                ...basketYears.map((year) => ({ label: year, value: year })),
                            ]}
                        />
                    </div>
                    <Space className="basket-picker-toolbar__actions">
                        <Button type="primary" onClick={() => handleAddNode(null)}>
                            Төлөвлөгөө нэмэх
                        </Button>
                        <Button icon={<ReloadOutlined />} onClick={fetchTreeData}>
                            Шинэчлэх
                        </Button>
                    </Space>
                </div>

                <Spin spinning={loading} tip="Мэдээлэл татаж байна...">
                    <Card className="basket-picker-tree-card" styles={{ body: { padding: 0 } }}>
                        <div className="basket-picker-tree-card__header">
                            <div><strong>Таны багцууд</strong><span>Багцын нэр дээр дарж сонгоно уу</span></div>
                            <Tag bordered={false} color="blue">{filteredBasketCount} багц</Tag>
                        </div>
                        <div className="basket-picker-tree-card__body">
                        {filteredTreeData.length ? (
                            <Tree
                                showIcon
                                blockNode
                                selectable
                                expandedKeys={expandedKeys}
                                onExpand={setExpandedKeys}
                                onSelect={handleTreeSelect}
                                selectedKeys={[]}
                                treeData={decorateTree(filteredTreeData)}
                                defaultExpandAll={false}
                            />
                        ) : (
                            <Empty description={treeSearch || activeBasketYear !== "all" ? "Шүүлтүүрт тохирох багц олдсонгүй" : "Багц байхгүй"} />
                        )}
                        </div>
                    </Card>
                </Spin>
            </Modal>
        </>
    );
};

MyModalWithTable.propTypes = {
    visible: PropTypes.bool.isRequired,
    setVisible: PropTypes.func.isRequired,
    selectedRows: PropTypes.arrayOf(PropTypes.object).isRequired,
    removeInsertedRows: PropTypes.func.isRequired,
    onInserted: PropTypes.func,
};

export default MyModalWithTable;
