import React, { useEffect, useState } from "react";
import {
    Modal,
    Card,
    Tree,
    Button,
    Typography,
    Popconfirm,
    Space,
    Tooltip,
    Input,
    Spin,
    message,
} from "antd";
import {
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

const { Title } = Typography;

const AddBasketModal = ({ open, onCancel }) => {
    const [treeData, setTreeData] = useState([]);
    const [expandedKeys, setExpandedKeys] = useState([]);
    const [editingKey, setEditingKey] = useState(null);
    const [editingValue, setEditingValue] = useState("");
    const [loading, setLoading] = useState(false);

    const user = JSON.parse(localStorage.getItem("data") || "{}");
    const API_BASE = "http://172.30.30.30:3636";

    /** 🔁 Fetch data from API */
    const fetchTreeData = async () => {
        if (!user?.id) {
            message.warning("Хэрэглэгчийн мэдээлэл олдсонгүй!");
            return;
        }

        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/get/basket`);
            const allData = res.data || [];
            const userData = allData.filter((b) => b.user_id === user.id);

            const plans = {};

            userData.forEach((item) => {
                if (!plans[item.plan_root_number]) {
                    plans[item.plan_root_number] = {
                        key: `plan-${item.plan_root_number}`,
                        title: item.plan_name,
                        type: "plan",
                        plan_root_number: item.plan_root_number,
                        icon: <FolderOpenOutlined style={{ color: "#1677ff" }} />,
                        children: {},
                    };
                }

                const plan = plans[item.plan_root_number];
                if (!plan.children[item.basket_type]) {
                    plan.children[item.basket_type] = {
                        key: `type-${item.plan_root_number}-${item.basket_type}`,
                        title: item.basket_type,
                        type: "type",
                        plan_root_number: item.plan_root_number,
                        basket_type: item.basket_type,
                        icon: <FolderOutlined style={{ color: "#52c41a" }} />,
                        children: [],
                    };
                }

                plan.children[item.basket_type].children.push({
                    key: `basket-${item.basket_id}`,
                    title: item.basket_name.trim(),
                    type: "basket",
                    basket_id: item.basket_id,
                    plan_root_number: item.plan_root_number,
                    basket_type: item.basket_type,
                    icon: <FileOutlined />,
                });
            });

            const structured = Object.values(plans).map((p) => ({
                ...p,
                children: Object.values(p.children),
            }));

            setTreeData(structured);
            setExpandedKeys(structured.map((p) => p.key));
        } catch (err) {
            console.error(err);
            message.error("Мэдээлэл татахад алдаа гарлаа!");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) fetchTreeData();
    }, [open]);

    /** 🧩 Add basket */
    const postBasket = async (payload) => {
        try {
            await axios.post(`${API_BASE}/post/addBasket`, payload);
            message.success("✅ Амжилттай нэмэгдлээ!");
            await fetchTreeData();
        } catch (err) {
            console.error("❌ Add error:", err);
            message.error("Алдаа гарлаа!");
        }
    };

    /** 🧨 Delete basket / type / plan */
    const deleteNode = async (node) => {
        if (!user?.id) return;

        let payload = { user_id: user.id };

        if (node.type === "plan") {
            payload.plan_root_number = node.plan_root_number;
        } else if (node.type === "type") {
            payload.plan_root_number = node.plan_root_number;
            payload.basket_type = node.basket_type;
        } else if (node.type === "basket") {
            payload.basket_id = node.basket_id;
        }

        try {
            console.log("🗑️ Delete payload:", payload);

            const res = await axios.delete(`${API_BASE}/delete/deleteBasket`, {
                data: payload,
                headers: { "Content-Type": "application/json" },
            });

            // 🧠 Use backend message if available
            if (res?.data?.message) {
                message.success(`✅ ${res.data.message}`);
            } else {
                message.success("✅ Амжилттай устгагдлаа!");
            }

            // Optional: if backend returns deleted_count or scope
            if (res?.data?.deleted_count >= 0) {
                console.log(
                    `Deleted ${res.data.deleted_count} record(s) [${res.data.deleted_scope}]`
                );
            }

            // Refresh the tree
            await fetchTreeData();
        } catch (err) {
            console.error("❌ Delete error:", err);

            // Extract backend error message (if any)
            const backendMsg =
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                "Устгах үед алдаа гарлаа!";

            message.error(`⚠️ ${backendMsg}`);
        }

    };

    /** ➕ Add logic */
    const handleAddNode = async (node) => {
        const today = dayjs().format("YYYY-MM-DD");
        const nextWeek = dayjs().add(7, "day").format("YYYY-MM-DD");

        // 🌲 Add new plan
        if (!node) {
            const payload = {
                userId: user.id,
                planName: "Шинэ төлөвлөгөө",
                planRootNumber: Math.floor(Math.random() * 100000),
                basketType: "Ерөнхий",
                basketName: "Төлөвлөгөөний эхлэл",
                basketNumber: 1,
                publishDate: today,
                setDate: nextWeek,
            };
            await postBasket(payload);
            return;
        }

        // 🗂 Add new category
        if (node.type === "plan") {
            const payload = {
                userId: user.id,
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

        // 📦 Add new basket
        if (node.type === "type") {
            const payload = {
                userId: user.id,
                planName: node.title,
                planRootNumber: node.plan_root_number,
                basketType: node.basket_type,
                basketName: "Шинэ багц",
                basketNumber: Math.floor(Math.random() * 100),
                publishDate: today,
                setDate: nextWeek,
            };
            await postBasket(payload);
        }
    };

    /** ✏️ Rename (frontend only) */
    const startEditing = (node) => {
        setEditingKey(node.key);
        setEditingValue(node.title);
    };
    const saveEditing = async (node) => {
        if (!editingValue.trim()) return;
        const newName = editingValue.trim();

        const payload = {
            user_id: user.id,
        };

        // Detect rename type
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
            console.log("PUT rename payload:", payload);
            const res = await axios.put(`${API_BASE}/update/updateBasket`, payload, {
                headers: { "Content-Type": "application/json" },
            });

            if (res?.data?.message) {
                message.success(`✏️ ${res.data.message}`);
            } else {
                message.success("✅ Амжилттай нэр өөрчлөгдлөө!");
            }

            // Update local tree data
            const renameRecursive = (list) =>
                list.map((item) => {
                    if (item.key === node.key) return { ...item, title: newName };
                    if (item.children)
                        return { ...item, children: renameRecursive(item.children) };
                    return item;
                });

            setTreeData((prev) => renameRecursive(prev));

            setEditingKey(null);
            setEditingValue("");
        } catch (err) {
            console.error("❌ Rename error:", err);
            const backendMsg =
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                "Нэр өөрчлөх үед алдаа гарлаа!";
            message.error(`⚠️ ${backendMsg}`);
        }
    };

    const cancelEditing = () => {
        setEditingKey(null);
        setEditingValue("");
    };

    /** Expand/collapse */
    const handleClickName = (node) => {
        const isExpanded = expandedKeys.includes(node.key);
        if (isExpanded) {
            setExpandedKeys((prev) => prev.filter((k) => k !== node.key));
        } else {
            setExpandedKeys((prev) => [...prev, node.key]);
        }
    };

    /** Node renderer */
    const renderTitle = (node) => (
        <Space
            size={4}
            onClick={(e) => {
                e.stopPropagation();
                handleClickName(node);
            }}
            style={{ cursor: "pointer" }}
        >
            {editingKey === node.key ? (
                <>
                    <Input
                        size="small"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: 150 }}
                    />
                    <Button
                        size="small"
                        type="link"
                        icon={<CheckOutlined style={{ color: "#52c41a" }} />}
                        onClick={(e) => {
                            e.stopPropagation();
                            saveEditing(node);
                        }}
                    />
                    <Button
                        size="small"
                        type="link"
                        icon={<CloseOutlined style={{ color: "#ff4d4f" }} />}
                        onClick={(e) => {
                            e.stopPropagation();
                            cancelEditing();
                        }}
                    />
                </>
            ) : (
                <>
                    <span>{node.title}</span>

                    {/* ✏️ Rename */}
                    <Tooltip title="Нэр өөрчлөх">
                        <Button
                            size="small"
                            type="link"
                            icon={<EditOutlined style={{ color: "#1677ff" }} />}
                            onClick={(e) => {
                                e.stopPropagation();
                                startEditing(node);
                            }}
                        />
                    </Tooltip>

                    {/* ➕ Add */}
                    {node.type !== "basket" && (
                        <Tooltip title="Нэмэх">
                            <Button
                                size="small"
                                type="link"
                                icon={<PlusCircleOutlined style={{ color: "#52c41a" }} />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddNode(node);
                                }}
                            />
                        </Tooltip>
                    )}

                    {/* ➖ Delete */}
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
                                icon={<MinusCircleOutlined style={{ color: "#ff4d4f" }} />}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </Popconfirm>
                    </Tooltip>
                </>
            )}
        </Space>
    );

    const decorateTree = (list) =>
        list.map((item) => ({
            ...item,
            title: renderTitle(item),
            children: item.children ? decorateTree(item.children) : [],
        }));

    return (
        <Modal
            title="Төлөвлөгөө → Ангилал → Багц"
            open={open}
            onCancel={onCancel}
            footer={null}
            width={800}
            centered
            getContainer={false}
        >
            <Spin spinning={loading} tip="Мэдээлэл татаж байна...">
                <Card
                    title={
                        <Space>

                            <Button
                                type="primary"
                                size="small"
                                onClick={() => handleAddNode(null)}
                            >
                                ➕ Төлөвлөгөө нэмэх
                            </Button>
                            <Button
                                icon={<ReloadOutlined />}
                                size="small"
                                onClick={fetchTreeData}
                            >
                                Шинэчлэх
                            </Button>
                        </Space>
                    }
                    bodyStyle={{ maxHeight: 460, overflowY: "auto" }}
                >
                    <Tree
                        showIcon
                        expandedKeys={expandedKeys}
                        onExpand={setExpandedKeys}
                        treeData={decorateTree(treeData)}
                        selectable={false}
                    />
                </Card>
            </Spin>
        </Modal>
    );
};

export default AddBasketModal;
// THIS FUNCTION IS NO LONGER USED ANYWHERE IN THE PROJECT
// THE FUNCTION BELOW IS JUST LEFT HERE FOR REFERENCE PURPOSES ONLY