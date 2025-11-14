import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Modal,
    Table,
    Button,
    Space,
    Spin,
    message,
    Form,
    Input,
    DatePicker,
    Select,
    Card,
    Tree,
    Tooltip,
    Popconfirm,
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
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";

const { Option } = Select;
const { Search } = Input;

const MyModalWithTable = ({
    visible,
    setVisible,
    selectedRows,
    removeInsertedRows,
    onInserted,   // ✅ new callback
}) => {
    // --- config & user
    const user = JSON.parse(localStorage.getItem("data") || "{}");
    const envUrl = import.meta.env.VITE_API_URL;
    // fallback to the IP used in your AddBasketModal if env not set
    const API_BASE_URL = import.meta.env.VITE_API_URL;

    // --- state
    const [treeData, setTreeData] = useState([]);
    const [expandedKeys, setExpandedKeys] = useState([]);
    const [editingKey, setEditingKey] = useState(null);
    const [editingValue, setEditingValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [addFormVisible, setAddFormVisible] = useState(false);
    const [form] = Form.useForm();
    const [searchTerm, setSearchTerm] = useState("");

    // --- helpers
    const formatDate = useCallback((value) => (value ? value.split("T")[0] : ""), []);
    const formatISO = useCallback((value) => {
        if (!value) return null;
        const d = new Date(value);
        return isNaN(d) ? null : d.toISOString();
    }, []);

    // --- fetch baskets and build tree (group by plan_root_number -> basket_type -> baskets)
    const fetchTreeData = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/get/basket`);
            const allData = res.data || [];
            const userData = allData.filter((b) => b.user_id === user.id);

            const plans = {};
            userData.forEach((item) => {
                const planKey = item.plan_root_number ?? `plan_${Math.random()}`;
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
                        basket_type: item.basket_type,
                        icon: <FolderOutlined style={{ color: "#52c41a" }} />,
                        children: [],
                    };
                }

                plan.childrenMap[typeKey].children.push({
                    key: `basket-${item.basket_id}`,
                    title: (item.basket_name || "Шинэ багц").trim(),
                    type: "basket",
                    basket_id: item.basket_id,
                    plan_root_number: item.plan_root_number,
                    basket_type: item.basket_type,
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

            // ✅ Automatically expand everything
            const allKeys = [];
            const collectKeys = (nodes) => {
                nodes.forEach((n) => {
                    allKeys.push(n.key);
                    if (n.children && n.children.length) collectKeys(n.children);
                });
            };
            collectKeys(structured);
            setExpandedKeys(allKeys); // <-- expand all nodes

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
            // cleanup
            setTreeData([]);
            setExpandedKeys([]);
        }
    }, [visible, fetchTreeData]);

    // --- flatten items helper for confirmation table
    const getFlattenedSelected = useCallback(() => selectedRows.flatMap((r) => r.items || [r]), [selectedRows]);

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
                const pkgPairs = selectedRows.flatMap((row) =>
                    (row.items || [row])
                        .filter((item) => item.pkgno && item.pkgdate)
                        .map((item) => ({ pkgno: item.pkgno, pkgdate: item.pkgdate }))
                );
                const uniquePkgPairs = Array.from(
                    new Map(pkgPairs.map((p) => [`${p.pkgno}_${p.pkgdate}`, p])).values()
                );

                // Step 2: send inserts in batches
                const items = selectedRows.flatMap((r) => r.items || [r]);
                const batchSize = 30;
                for (let i = 0; i < items.length; i += batchSize) {
                    const batch = items.slice(i, i + batchSize);
                    await Promise.allSettled(
                        batch.map((item) =>
                            axios.post(`${API_BASE_URL}/post/PostBasketItems`, {
                                basketId: basketRecord.basket_id,
                                acct: item.acct,
                                barcode: item.barcode,
                                cdate: formatISO(item.cdate),
                                ddate: formatISO(item.ddate),
                                dedate: formatISO(item.dedate),
                                udate: formatISO(item.udate),
                                code: item.code,
                                dcode: item.dcode,
                                dname: item.dname,
                                mdocno: item.mdocno,
                                measid: item.measid,
                                mname: item.mname,
                                qty: item.qty?.toString() || "",
                                price: item.price?.toString() || "",
                                pricesum: item.pricesum?.toString() || "",
                                pkgno: item.pkgno,
                                pkgdate: item.pkgdate,
                                planurl: item.planurl,
                                techurl: item.techurl,
                                techdate: item.techdate,
                                plandate: item.plandate,
                                usize: item.usize,
                                rid: item.rid,
                                zno: item.zno,
                                cr1id: item.cr1id,
                                cr1name: item.cr1name,
                                cr2id: item.cr2id,
                                cr3id: item.cr3id,
                                cr4id: item.cr4id,
                                cr4name: item.cr4name,
                                crbrand: item.crbrand,
                                crbrandname: item.crbrandname,
                                crmark: item.crmark,
                                crmarkname: item.crmarkname,
                            })
                        )
                    );
                }

                // Step 3: status updates
                await Promise.allSettled(
                    uniquePkgPairs.map(async ({ pkgno, pkgdate }) => {
                        const formattedDate = pkgdate.replace(/-/g, "/");
                        await axios.post("http://192.168.4.107:8008/v1/orders/status", {
                            Pkgno: pkgno,
                            Pkgdate: formattedDate,
                            State: "2",
                        });
                    })
                );

                // Step 4: success & cleanup
                message.success(
                    `✅ ${selectedRows.length} мөр амжилттай нэмэгдлээ (${uniquePkgPairs.length} статус илгээгдлээ).`
                );
                removeInsertedRows(selectedRows);
                await fetchTreeData();
                // ✅ Notify parent (Багцлах.jsx)
                if (typeof onInserted === "function") onInserted();
            } catch (err) {
                console.error("❌ Insert error:", err);
                message.error("⚠️ Зарим өгөгдлийг илгээхэд алдаа гарлаа!");
            } finally {
                hideMsg();
                setLoading(false);
            }
        },
        [API_BASE_URL, selectedRows, removeInsertedRows, fetchTreeData, formatISO]
    );

    // --- When user clicks a basket node: show confirmation table then insert
    const handleClickBasket = useCallback(
        (basketNode) => {
            const flattened = getFlattenedSelected();
            if (!flattened.length) {
                message.warning("Нэмэх өгөгдөл сонгоно уу!");
                return;
            }
            Modal.confirm({
                title: "Мэдээлэл нэмэх",
                icon: <ExclamationCircleOutlined />,
                width: 900,
                centered: true,
                content: (
                    <div style={{ maxHeight: 400, overflowY: "auto" }}>
                        <p>Та дараах өгөгдлийг оруулах уу?</p>
                        <Table
                            dataSource={flattened}
                            columns={[
                                { title: "Нэр", dataIndex: "cr4name" },
                                { title: "Салбар нэгж", dataIndex: "dname" },
                                { title: "Марк", dataIndex: "crmarkname" },
                                { title: "Нэгж", dataIndex: "mname", width: "10%" },
                                { title: "Хэмжих нэгж", dataIndex: "usize", width: "15%" },
                                { title: "Тоо", dataIndex: "qty" },
                                {
                                    title: "Нэгж үнэ",
                                    dataIndex: "price",
                                    render: (val) => (val ? Number(val).toLocaleString("en-US") : "-"),
                                },
                                {
                                    title: "Нийт үнэ",
                                    dataIndex: "pricesum",
                                    render: (val) => (val ? Number(val).toLocaleString("en-US") : "-"),
                                },
                            ]}
                            pagination={false}
                            size="small"
                            bordered
                            rowKey={(r, idx) =>
                                `${r.code || idx}-${r.dname || ""}-${r.qty || 0}-${r.price || 0}`
                            }
                        />
                    </div>
                ),
                okText: "Тийм",
                cancelText: "Үгүй",
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
                console.log("Posting basket:", full);
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
                    planRootNumber: Math.floor(Math.random() * 100000),
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
                    basketType: "Шинэ ангилал",
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
                    planName: node.title,
                    planRootNumber: node.plan_root_number,
                    basketType: node.basket_type,
                    basketName: "Шинэ багц",
                    basketNumber: Math.floor(Math.random() * 100),
                    publishDate: today,
                    setDate: nextWeek,
                };
                await postBasket(payload);
                return;
            }
        },
        [postBasket]
    );
    const checkBasketHasItems = async (basketId) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/get/Items`);
            const items = res.data || [];
            const hasItems = items.some((i) => i.basketId === basketId);
            return hasItems;
        } catch (err) {
            console.error("❌ checkBasketHasItems:", err);
            return false;
        }
    };

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
                    const basketItems = items.filter((i) => i.basketId === node.basket_id);
                    hasItems = basketItems.length > 0;
                    totalCount = basketItems.length;
                }
                else if (node.type === "type") {
                    // find all basket IDs belonging to this type
                    const allTypeBaskets = treeData
                        .flatMap((p) => p.children || [])
                        .find((t) => t.key === node.key)?.children || [];

                    const basketIds = allTypeBaskets.map((b) => b.basket_id);
                    const typeItems = items.filter((i) => basketIds.includes(i.basketId));
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

                    const planItems = items.filter((i) => allBasketIds.includes(i.basketId));
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

            // 🧨 Ask confirmation before delete
            Modal.confirm({
                title: "Устгах уу?",
                content: `Та "${node.title}"-г устгахдаа итгэлтэй байна уу?`,
                okText: "Тийм",
                cancelText: "Үгүй",
                centered: true,
                onOk: async () => {
                    try {
                        setLoading(true);
                        const res = await axios.delete(`${API_BASE_URL}/delete/deleteBasket`, {
                            data: payload,
                            headers: { "Content-Type": "application/json" },
                        });
                        if (res?.data?.message)
                            message.success(`✅ ${res.data.message}`);
                        else
                            message.success("✅ Амжилттай устгагдлаа!");
                        await fetchTreeData(); // refresh tree
                    } catch (err) {
                        console.error("❌ deleteNode:", err);
                        const backendMsg =
                            err?.response?.data?.error ||
                            err?.response?.data?.message ||
                            "Устгах үед алдаа гарлаа!";
                        message.error(`⚠️ ${backendMsg}`);
                    } finally {
                        setLoading(false);
                    }
                },
            });
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
    const handleClickName = useCallback((node, e) => {
        // If clicked basket title, trigger insertion confirmation
        if (node.type === "basket") {
            handleClickBasket(node);
            return;
        }
        // else toggle expand
        const isExpanded = expandedKeys.includes(node.key);
        if (isExpanded) setExpandedKeys((prev) => prev.filter((k) => k !== node.key));
        else setExpandedKeys((prev) => [...prev, node.key]);
    }, [expandedKeys, handleClickBasket]);

    const renderTitle = useCallback(
        (node) => (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClickName(node, e);
                            }}
                            style={{ cursor: "pointer", minWidth: 200, display: "inline-block" }}
                        >
                            {node.title}
                        </span>

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
            handleClickName,
        ]
    );

    const decorateTree = useCallback(
        (list) =>
            list
                .filter((n) => (searchTerm ? n.title?.toLowerCase().includes(searchTerm.toLowerCase()) : true))
                .map((item) => ({
                    ...item,
                    title: renderTitle(item),
                    children: item.children ? decorateTree(item.children) : [],
                })),
        [renderTitle, searchTerm]
    );

    // --- Table columns (kept for optional view or debugging)
    const columns = useMemo(
        () => [
            { title: "Огноо", dataIndex: "set_date", render: (val) => formatDate(val), width: 100 },
            { title: "Төлөвлөгөөний нэр", dataIndex: "plan_name", width: 300 },
            { title: "Төлөвлөгөөний дугаар", dataIndex: "plan_root_number", width: 120 },
            { title: "Ангилал", dataIndex: "basket_type", width: 140 },
            { title: "Тендер зарлах огноо", dataIndex: "publish_date", render: formatDate, width: 140 },
            { title: "Багцын дугаар", dataIndex: "basket_number", width: 120 },
            { title: "Багцын нэр", dataIndex: "basket_name", width: 200 },
            {
                title: "Үйлдэл",
                key: "action",
                width: 120,
                render: (_, record) => (
                    <Button
                        style={{ width: 100 }}
                        type="primary"
                        size="small"
                        disabled={!selectedRows?.length}
                        onClick={() => {
                            // If you prefer table-based add to basket you can still use this
                            Modal.confirm({
                                title: "Мэдээлэл нэмэх",
                                icon: <ExclamationCircleOutlined />,
                                width: 900,
                                centered: true,
                                content: (
                                    <div style={{ maxHeight: 400, overflowY: "auto" }}>
                                        <p>Та дараах өгөгдлийг оруулах уу?</p>
                                        <Table
                                            dataSource={getFlattenedSelected()}
                                            columns={[
                                                { title: "Нэр", dataIndex: "cr4name" },
                                                { title: "Салбар нэгж", dataIndex: "dname" },
                                                { title: "Марк", dataIndex: "crmarkname" },
                                                { title: "Нэгж", dataIndex: "mname", width: "10%" },
                                                { title: "Хэмжих нэгж", dataIndex: "usize", width: "15%" },
                                                { title: "Тоо", dataIndex: "qty" },
                                                {
                                                    title: "Нэгж үнэ",
                                                    dataIndex: "price",
                                                    render: (val) => (val ? Number(val).toLocaleString("en-US") : "-"),
                                                },
                                                {
                                                    title: "Нийт үнэ",
                                                    dataIndex: "pricesum",
                                                    render: (val) => (val ? Number(val).toLocaleString("en-US") : "-"),
                                                },
                                            ]}
                                            pagination={false}
                                            size="small"
                                            bordered
                                            rowKey={(r, idx) =>
                                                `${r.code || idx}-${r.dname || ""}-${r.qty || 0}-${r.price || 0}`
                                            }
                                        />
                                    </div>
                                ),
                                okText: "Тийм",
                                cancelText: "Үгүй",
                                onOk: () => handleConfirmInsert(record),
                            });
                        }}
                    >
                        Нэмэх
                    </Button>
                ),
            },
        ],
        [selectedRows, handleConfirmInsert]
    );

    return (
        <>
            {/* Main modal shows tree */}
            <Modal
                title="Төлөвлөгөө → Ангилал → Багц"
                open={visible}
                onCancel={() => setVisible(false)}
                footer={null}
                width={800}
                getContainer={false}
                destroyOnClose
            >
                <Space style={{ marginBottom: 12, width: "100%", justifyContent: "space-between" }}>
                    <Space>
                        <Button type="primary" onClick={() => handleAddNode(null)}>
                            ➕ Төлөвлөгөө нэмэх
                        </Button>
                        <Button icon={<ReloadOutlined />} onClick={fetchTreeData}>
                            Шинэчлэх
                        </Button>
                    </Space>

                </Space>

                <Spin spinning={loading} tip="Мэдээлэл татаж байна...">
                    <Card bodyStyle={{ maxHeight: 520, overflowY: "auto" }}>
                        <Tree
                            showIcon
                            expandedKeys={expandedKeys}
                            onExpand={setExpandedKeys}
                            treeData={decorateTree(treeData)}
                            selectable={false}
                            defaultExpandAll={false}
                        />
                    </Card>
                </Spin>
            </Modal>

            {/* Inline add-basket form modal (if you want to create with custom fields) */}
            <Modal
                title="Шинэ багц нэмэх"
                open={addFormVisible}
                onCancel={() => setAddFormVisible(false)}
                onOk={async () => {
                    try {
                        const values = await form.validateFields();
                        setAddFormVisible(false);
                        form.resetFields();
                        // prepare payload similar to previous AddBasketModal
                        const payload = {
                            planName: values.plan_name || values.basket_name,
                            planRootNumber: values.plan_root_number || Math.floor(Math.random() * 100000),
                            basketType: values.basket_type,
                            basketName: values.basket_name,
                            basketNumber: values.basket_number || 1,
                            publishDate: values.publish_date ? values.publish_date.format("YYYY-MM-DD") : undefined,
                            setDate: values.set_date ? values.set_date.format("YYYY-MM-DD") : undefined,
                        };
                        await postBasket(payload);
                    } catch (err) {
                        // validation or post error handled inside postBasket
                    }
                }}
                centered
            >
                <Form layout="vertical" form={form}>
                    <Form.Item name="basket_name" label="Багцын нэр" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="basket_number" label="Багцын дугаар">
                        <Input />
                    </Form.Item>
                    <Form.Item name="plan_name" label="Төлөвлөгөөний нэр">
                        <Input />
                    </Form.Item>
                    <Form.Item name="publish_date" label="Тендер зарлах огноо">
                        <DatePicker style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item name="basket_type" label="Ангилал" rules={[{ required: true }]}>
                        <Select>
                            <Option value="Тендер">Тендер</Option>
                            <Option value="Бараа">Бараа</Option>
                            <Option value="Үйлчилгээ">Үйлчилгээ</Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default MyModalWithTable;
