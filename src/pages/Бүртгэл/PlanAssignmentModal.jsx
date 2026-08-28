import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Empty, Input, Modal, Popconfirm, Select, Spin, Tag, Tooltip, Typography, message } from "antd";
import {
    CalendarOutlined,
    CheckOutlined,
    CloseOutlined,
    DeleteOutlined,
    EditOutlined,
    PlusOutlined,
    ProjectOutlined,
    SearchOutlined,
} from "@ant-design/icons";
import axios from "axios";
import PropTypes from "prop-types";

const API_BASE_URL = import.meta.env.VITE_API_URL;
export const PLAN_INBOX_TYPE = "PLAN_INBOX";
export const PLAN_INBOX_NAME = "Хуваарилаагүй захиалга";
const { Text } = Typography;

const normalize = (value) => String(value ?? "").trim();
const toInteger = (value) => Number.parseInt(normalize(value), 10) || 0;
const flattenRows = (rows) => rows.flatMap((row) => row.items?.length ? row.items : [row]);
const getItemId = (item) => item.basketItemId ?? item.BasketItemId ?? item.basket_item_id ?? item.id;
const getPlanYear = (basket) => normalize(basket.publish_date || basket.set_date).match(/^(\d{4})/)?.[1] || "";
const createPlanRootNumber = () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return 1_000_000_000 + (values[0] % 1_000_000_000);
};
const currentYear = new Date().getFullYear();
const defaultYears = [currentYear - 1, currentYear, currentYear + 1].map(String);

const PlanAssignmentModal = ({ visible, setVisible, selectedRows, removeInsertedRows, onInserted }) => {
    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("data") || "{}");
        } catch {
            return {};
        }
    }, []);
    const [plans, setPlans] = useState([]);
    const [selectedPlanKey, setSelectedPlanKey] = useState("");
    const [searchText, setSearchText] = useState("");
    const [activeYear, setActiveYear] = useState("all");
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [newPlanName, setNewPlanName] = useState("");
    const [newPlanYear, setNewPlanYear] = useState(String(currentYear));
    const [editingPlanKey, setEditingPlanKey] = useState("");
    const [editingPlanName, setEditingPlanName] = useState("");
    const [loading, setLoading] = useState(false);

    const loadPlans = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const [basketResponse, itemResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/get/basket`),
                axios.get(`${API_BASE_URL}/get/Items`),
            ]);
            const grouped = new Map();

            (basketResponse.data || [])
                .filter((basket) => String(basket.user_id) === String(user.id) && !basket.is_temp)
                .forEach((basket) => {
                    const rootNumber = basket.plan_root_number;
                    if (rootNumber === null || rootNumber === undefined || rootNumber === "") return;
                    const key = String(rootNumber);
                    if (!grouped.has(key)) {
                        grouped.set(key, {
                            key,
                            planRootNumber: toInteger(rootNumber),
                            planName: normalize(basket.plan_name) || `Төлөвлөгөө ${rootNumber}`,
                            year: getPlanYear(basket),
                            basketCount: 0,
                            inboxBasketId: null,
                            basketIds: [],
                            orderCount: 0,
                            representative: basket,
                        });
                    }
                    const plan = grouped.get(key);
                    plan.basketIds.push(String(basket.basket_id));
                    if (normalize(basket.basket_type).toUpperCase() === PLAN_INBOX_TYPE) {
                        plan.inboxBasketId = basket.basket_id;
                    } else {
                        plan.basketCount += 1;
                    }
                });

            const itemCounts = new Map();
            (itemResponse.data || []).forEach((item) => {
                const basketId = String(item.basketId ?? item.BasketId ?? item.basket_id ?? "");
                itemCounts.set(basketId, (itemCounts.get(basketId) || 0) + 1);
            });
            grouped.forEach((plan) => {
                plan.orderCount = plan.basketIds.reduce((sum, basketId) => sum + (itemCounts.get(basketId) || 0), 0);
            });

            setPlans([...grouped.values()].sort((first, second) => first.planName.localeCompare(second.planName)));
        } catch (error) {
            console.error("Plan list fetch failed:", error);
            message.error("Төлөвлөгөөний жагсаалт татахад алдаа гарлаа");
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        if (visible) loadPlans();
        else {
            setSelectedPlanKey("");
            setSearchText("");
            setActiveYear("all");
            setEditingPlanKey("");
            setEditingPlanName("");
        }
    }, [loadPlans, visible]);

    const filteredPlans = useMemo(() => {
        const query = searchText.trim().toLocaleLowerCase();
        return plans.filter((plan) => {
            if (activeYear !== "all" && plan.year !== activeYear) return false;
            if (!query) return true;
            return [plan.planName, plan.planRootNumber, plan.year]
                .some((value) => normalize(value).toLocaleLowerCase().includes(query));
        });
    }, [activeYear, plans, searchText]);

    const yearOptions = useMemo(
        () => [...new Set([...defaultYears, ...plans.map((plan) => plan.year).filter(Boolean)])]
            .sort((first, second) => second.localeCompare(first)),
        [plans]
    );

    const createPlan = async () => {
        const planName = newPlanName.trim();
        if (!planName) {
            message.warning("Төлөвлөгөөний нэр оруулна уу");
            return;
        }
        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/post/addBasket`, {
                userId: user.id,
                planName,
                planRootNumber: createPlanRootNumber(),
                basketType: PLAN_INBOX_TYPE,
                basketName: PLAN_INBOX_NAME,
                basketNumber: 0,
                publishDate: `${newPlanYear}-01-01`,
                setDate: `${newPlanYear}-12-31`,
                isTemp: false,
            });
            await loadPlans();
            setCreateModalOpen(false);
            setNewPlanName("");
            setActiveYear(newPlanYear);
            message.success(`“${planName}” төлөвлөгөө үүслээ`);
            return response.data;
        } catch (error) {
            console.error("Plan creation failed:", error);
            message.error(error.response?.data?.message || error.response?.data?.error || "Төлөвлөгөө үүсгэхэд алдаа гарлаа");
        } finally {
            setLoading(false);
        }
    };

    const savePlanName = async (plan) => {
        const planName = editingPlanName.trim();
        if (!planName) {
            message.warning("Төлөвлөгөөний нэр хоосон байж болохгүй");
            return;
        }
        setLoading(true);
        try {
            await axios.put(`${API_BASE_URL}/put/UpdateBasket`, {
                user_id: user.id,
                plan_root_number: toInteger(plan.planRootNumber),
                new_plan_name: planName,
            });
            setPlans((current) => current.map((entry) => entry.key === plan.key
                ? { ...entry, planName }
                : entry));
            setEditingPlanKey("");
            setEditingPlanName("");
            message.success("Төлөвлөгөөний нэр шинэчлэгдлээ");
        } catch (error) {
            console.error("Plan rename failed:", error);
            message.error(error.response?.data?.message || error.response?.data?.error || "Нэр өөрчлөхөд алдаа гарлаа");
        } finally {
            setLoading(false);
        }
    };

    const deletePlan = async (plan) => {
        if (plan.orderCount > 0) {
            message.warning(`Энэ төлөвлөгөөнд ${plan.orderCount} захиалга байна. Эхлээд захиалгуудыг шилжүүлэх эсвэл хасна уу.`);
            return;
        }
        setLoading(true);
        try {
            await axios.delete(`${API_BASE_URL}/delete/deleteBasket`, {
                data: {
                    user_id: user.id,
                    plan_root_number: toInteger(plan.planRootNumber),
                },
            });
            setPlans((current) => current.filter((entry) => entry.key !== plan.key));
            if (selectedPlanKey === plan.key) setSelectedPlanKey("");
            message.success("Төлөвлөгөө устгагдлаа");
        } catch (error) {
            console.error("Plan deletion failed:", error);
            message.error(error.response?.data?.message || error.response?.data?.error || "Төлөвлөгөө устгахад алдаа гарлаа");
        } finally {
            setLoading(false);
        }
    };

    const handleInsert = async () => {
        const plan = plans.find((entry) => entry.key === selectedPlanKey);
        if (!plan) {
            message.warning("Төлөвлөгөө сонгоно уу");
            return;
        }

        const items = flattenRows(selectedRows);
        const itemIds = items.map(getItemId).filter(Boolean);
        if (!itemIds.length || itemIds.length !== items.length) {
            message.error("Сонгосон захиалгын бүртгэлийн дугаар дутуу байна");
            return;
        }

        setLoading(true);
        try {
            let targetBasketId = plan.inboxBasketId;
            if (!targetBasketId) {
                const today = new Date().toISOString().slice(0, 10);
                const source = plan.representative || {};
                const response = await axios.post(`${API_BASE_URL}/post/addBasket`, {
                    userId: user.id,
                    planName: plan.planName,
                    planRootNumber: toInteger(plan.planRootNumber),
                    basketType: PLAN_INBOX_TYPE,
                    basketName: PLAN_INBOX_NAME,
                    basketNumber: 0,
                    publishDate: source.publish_date || today,
                    setDate: source.set_date || today,
                    isTemp: false,
                });
                targetBasketId = response.data?.basket_id;
            }
            if (!targetBasketId) throw new Error("Төлөвлөгөөний түр хэсэг үүссэнгүй");

            const response = await axios.put(`${API_BASE_URL}/put/MoveBasketItems`, {
                basket_item_ids: itemIds,
                target_basket_id: targetBasketId,
                user_id: user.id,
            });
            const movedCount = Number(response.data?.moved_count || 0);
            if (movedCount !== itemIds.length) throw new Error("Захиалгууд бүрэн шилжсэнгүй");

            removeInsertedRows(items);
            await onInserted?.();
            message.success(`${movedCount} захиалгыг “${plan.planName}” төлөвлөгөөнд орууллаа`);
            setVisible(false);
        } catch (error) {
            console.error("Move orders to plan failed:", error);
            const conflict = error.response?.data;
            if (conflict?.error === "PLAN_PRICE_CONFLICT") {
                Modal.error({
                    title: "Нэгж үнэ зөрүүтэй байна",
                    content: (
                        <div className="plan-price-conflict">
                            <div className="plan-price-conflict__product">
                                <strong>{conflict.item_name || "Барааны нэр тодорхойгүй"}</strong>
                                <span>{[conflict.mark, conflict.brand].filter(Boolean).join(" · ") || "Марк, брэндгүй"}</span>
                            </div>
                            <div className="plan-price-conflict__details">
                                <Text><strong>Код</strong><span>{conflict.code || "—"}</span></Text>
                                <Text><strong>Хэмжих нэгж</strong><span>{conflict.unit || "—"}</span></Text>
                                <Text><strong>Алба</strong><span>{conflict.department || "—"}</span></Text>
                                <Text><strong>Оруулах захиалгын багц</strong><span>{conflict.package_no || "—"}</span></Text>
                                <Text><strong>Төлөвлөгөөнд байгаа багц</strong><span>{conflict.existing_package_no || "—"}</span></Text>
                            </div>
                            <div className="plan-price-conflict__prices">
                                <div>
                                    <span>Төлөвлөгөөнд байгаа үнэ</span>
                                    <strong>{Number(conflict.existing_price).toLocaleString()} ₮</strong>
                                </div>
                                <div className="is-conflicting">
                                    <span>Оруулах гэж буй үнэ</span>
                                    <strong>{Number(conflict.incoming_price).toLocaleString()} ₮</strong>
                                </div>
                            </div>
                            <Text type="secondary">Ижил кодтой захиалгын нэгж үнэ ижил байх ёстой тул захиалгыг оруулсангүй.</Text>
                        </div>
                    ),
                    okText: "Ойлголоо",
                    centered: true,
                });
                return;
            }
            message.error(error.response?.data?.message || error.response?.data?.error || error.message || "Төлөвлөгөөнд оруулахад алдаа гарлаа");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
        <Modal
            title="Төлөвлөгөө сонгох"
            open={visible}
            onCancel={() => setVisible(false)}
            onOk={handleInsert}
            okText={`Төлөвлөгөөнд оруулах (${flattenRows(selectedRows).length})`}
            cancelText="Болих"
            okButtonProps={{ disabled: !selectedPlanKey }}
            confirmLoading={loading}
            width={960}
            centered
            destroyOnHidden
            className="plan-assignment-modal"
        >
            <div className="plan-assignment-modal__intro">
                <ProjectOutlined />
                <div>
                    <Text strong>{flattenRows(selectedRows).length} захиалга сонгосон</Text>
                    <Text type="secondary">Энд зөвхөн төлөвлөгөө сонгоно. Ангилал болон багцыг “Төлөвлөгөө” хэсэгт хуваарилна.</Text>
                </div>
            </div>
            <div className="plan-assignment-modal__toolbar">
                <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="Төлөвлөгөө хайх..."
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    className="plan-assignment-modal__search"
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
                    Төлөвлөгөө үүсгэх
                </Button>
            </div>
            <div className="plan-assignment-year-filter">
                <span className="plan-assignment-year-filter__label"><CalendarOutlined /> Он</span>
                <Button
                    className={activeYear === "all" ? "is-active" : ""}
                    onClick={() => setActiveYear("all")}
                >
                    Бүгд
                </Button>
                {yearOptions.map((year) => (
                    <Button
                        key={year}
                        className={activeYear === year ? "is-active" : ""}
                        onClick={() => setActiveYear(year)}
                    >
                        {year}
                    </Button>
                ))}
            </div>
            <Spin spinning={loading}>
                <div className="plan-assignment-list">
                    {filteredPlans.map((plan) => (
                        <div
                            key={plan.key}
                            role="button"
                            tabIndex={0}
                            className={`plan-assignment-card ${selectedPlanKey === plan.key ? "is-selected" : ""}`}
                            onClick={() => setSelectedPlanKey(plan.key)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") setSelectedPlanKey(plan.key);
                            }}
                        >
                            <span className="plan-assignment-card__icon"><ProjectOutlined /></span>
                            {editingPlanKey === plan.key ? (
                                <span className="plan-assignment-card__editor" onClick={(event) => event.stopPropagation()}>
                                    <Input
                                        value={editingPlanName}
                                        onChange={(event) => setEditingPlanName(event.target.value)}
                                        onPressEnter={() => savePlanName(plan)}
                                        autoFocus
                                    />
                                    <Button type="text" icon={<CheckOutlined />} onClick={() => savePlanName(plan)} />
                                    <Button type="text" icon={<CloseOutlined />} onClick={() => setEditingPlanKey("")} />
                                </span>
                            ) : (
                                <span className="plan-assignment-card__content">
                                    <strong>{plan.planName}</strong>
                                    <small>{plan.orderCount} захиалга</small>
                                </span>
                            )}
                            <span className="plan-assignment-card__meta">
                                {plan.year && <Tag icon={<CalendarOutlined />}>{plan.year}</Tag>}
                                <Tag color="blue">{plan.basketCount} багц</Tag>
                                <Tooltip title="Нэр өөрчлөх">
                                    <Button
                                        type="text"
                                        icon={<EditOutlined />}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setEditingPlanKey(plan.key);
                                            setEditingPlanName(plan.planName);
                                        }}
                                    />
                                </Tooltip>
                                <Popconfirm
                                    title="Төлөвлөгөө устгах уу?"
                                    description={plan.orderCount > 0
                                        ? `${plan.orderCount} захиалгатай тул устгах боломжгүй.`
                                        : "Төлөвлөгөө болон түүний хоосон ангилал, багцууд устна."}
                                    okText="Устгах"
                                    cancelText="Болих"
                                    okButtonProps={{ danger: true, disabled: plan.orderCount > 0 }}
                                    onConfirm={() => deletePlan(plan)}
                                >
                                    <Tooltip title="Устгах">
                                        <Button
                                            danger
                                            type="text"
                                            icon={<DeleteOutlined />}
                                            onClick={(event) => event.stopPropagation()}
                                        />
                                    </Tooltip>
                                </Popconfirm>
                            </span>
                        </div>
                    ))}
                    {!filteredPlans.length && !loading && <Empty description="Төлөвлөгөө олдсонгүй" />}
                </div>
            </Spin>
        </Modal>
        <Modal
            title="Шинэ төлөвлөгөө үүсгэх"
            open={createModalOpen}
            onCancel={() => setCreateModalOpen(false)}
            onOk={createPlan}
            okText="Үүсгэх"
            cancelText="Болих"
            confirmLoading={loading}
            okButtonProps={{ disabled: !newPlanName.trim() }}
            width={520}
            centered
            destroyOnHidden
        >
            <div className="plan-create-form">
                <label>
                    <span>Төлөвлөгөөний нэр</span>
                    <Input
                        value={newPlanName}
                        onChange={(event) => setNewPlanName(event.target.value)}
                        placeholder="Жишээ: 2027 оны худалдан авах төлөвлөгөө"
                        onPressEnter={createPlan}
                        autoFocus
                    />
                </label>
                <label>
                    <span>Он</span>
                    <Select
                        value={newPlanYear}
                        onChange={setNewPlanYear}
                        options={yearOptions.map((year) => ({ label: `${year} он`, value: year }))}
                    />
                </label>
            </div>
        </Modal>
        </>
    );
};

PlanAssignmentModal.propTypes = {
    visible: PropTypes.bool.isRequired,
    setVisible: PropTypes.func.isRequired,
    selectedRows: PropTypes.array.isRequired,
    removeInsertedRows: PropTypes.func.isRequired,
    onInserted: PropTypes.func,
};

export default PlanAssignmentModal;
