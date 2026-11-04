import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Button,
    Card,
    Checkbox,
    Empty,
    Input,
    Modal,
    Popconfirm,
    Select,
    Space,
    Spin,
    Table,
    Tag,
    Tooltip,
    Typography,
    message,
} from "antd";
import {
    CalendarOutlined,
    CheckCircleOutlined,
    DeleteOutlined,
    DownOutlined,
    FileAddOutlined,
    FolderOpenOutlined,
    LockOutlined,
    ProjectOutlined,
    PlusOutlined,
    ReloadOutlined,
    RightOutlined,
    RollbackOutlined,
    SearchOutlined,
    SwapOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { updateOrderStatus } from "../../api/orders";
import PrintIcon from "./PrintIcon";
import { PLAN_INBOX_TYPE } from "./PlanAssignmentModal";
import ТөлөвлөгөөItemDetails from "./ТөлөвлөгөөItemDetails";
import "./Төлөвлөгөө_table.css";

const API_BASE_URL = import.meta.env.VITE_API_URL;
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
const toInteger = (value) => Number.parseInt(normalize(value), 10) || 0;
const itemTotal = (item) => toNumber(item.price) * toNumber(item.qty);
const formatNumber = (value) => toNumber(value).toLocaleString();
const formatDate = (value) => {
    const normalized = normalize(value);
    if (!normalized) return "-";
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? normalized : date.toLocaleDateString("mn-MN");
};
const getDateYear = (value) => normalize(value).match(/^(\d{4})/)?.[1] || "";
const getItemId = (item) => unwrap(item.basketItemId ?? item.BasketItemId ?? item.basket_item_id ?? item.id);
const getPackageKey = (item) => `${normalize(item.pkgno)}_${normalize(item.pkgdate)}`;
const getItemYear = (item) => getDateYear(item.pkgdate || item.ddate || item.deathdate);
const getPlanKey = (planRootNumber, userId) => `${normalize(planRootNumber)}::${normalize(userId)}`;
const getConsolidationKey = (item, index = 0) => {
    const code = normalize(item.code);
    return code ? `code:${code}` : `item:${normalize(getItemId(item)) || index}`;
};
const countConsolidatedOrders = (items) => new Set(
    items.map((item, index) => getConsolidationKey(item, index))
).size;
const parseBasketIds = (value) => normalize(value)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
const getTenderLabel = (tender) => {
    if (!tender) return "";
    return normalize(tender.тендерийн_дугаар)
        || (tender.tender_id ? `Тендер #${tender.tender_id}` : "Тендер");
};
const getPlanTenderSummary = (baskets) => {
    const tenders = [];
    const seen = new Set();
    baskets.forEach((basket) => {
        if (!basket.tender) return;
        const key = normalize(basket.tender.tender_id) || getTenderLabel(basket.tender);
        if (seen.has(key)) return;
        seen.add(key);
        tenders.push(basket.tender);
    });
    return {
        tenders,
        tender_count: tenders.length,
        tendered_basket_count: baskets.filter((basket) => Boolean(basket.tender)).length,
        available_basket_count: baskets.filter((basket) => !basket.tender).length,
    };
};
const DEFAULT_BASKET_TYPE = "Ерөнхий";

const ТөлөвлөгөөTable = () => {
    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("data") || "{}");
        } catch {
            return {};
        }
    }, []);
    const isManager = normalize(user?.erh || user?.Erh).toLocaleLowerCase() === "удирдлага";

    const [data, setData] = useState([]);
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [activeYear, setActiveYear] = useState("all");
    const [expandedPlanKeys, setExpandedPlanKeys] = useState([]);
    const [expandedBasketKeys, setExpandedBasketKeys] = useState([]);

    const [tenderModalOpen, setTenderModalOpen] = useState(false);
    const [tenderLoading, setTenderLoading] = useState(false);
    const [tenderOptionsLoading, setTenderOptionsLoading] = useState(false);
    const [currentPlan, setCurrentPlan] = useState(null);
    const [tenderNumber, setTenderNumber] = useState("");
    const [selectedBasketIds, setSelectedBasketIds] = useState([]);
    const [lockedBasketIds, setLockedBasketIds] = useState([]);
    const [basketTenderMap, setBasketTenderMap] = useState({});
    const [assignmentPlan, setAssignmentPlan] = useState(null);
    const [selectedAssignmentIds, setSelectedAssignmentIds] = useState([]);
    const [assignmentBasketId, setAssignmentBasketId] = useState("");
    const [assignmentLoading, setAssignmentLoading] = useState(false);
    const [structureModalMode, setStructureModalMode] = useState("");
    const [newBasketName, setNewBasketName] = useState("");
    const [structureLoading, setStructureLoading] = useState(false);
    const [deletingBasketId, setDeletingBasketId] = useState(null);
    const [returningInboxPlanKey, setReturningInboxPlanKey] = useState("");

    const ensureTempBasket = useCallback(async () => {
        const basketResponse = await axios.get(`${API_BASE_URL}/get/basket`);
        const existing = (basketResponse.data || []).find(
            (basket) => String(basket.user_id) === String(user.id) && basket.is_temp
        );
        if (existing?.basket_id) return existing.basket_id;

        const today = new Date().toISOString().slice(0, 10);
        const response = await axios.post(`${API_BASE_URL}/post/addBasket`, {
            userId: user.id,
            basketName: "Миний сагс",
            basketNumber: 0,
            basketType: "TEMP",
            planName: "TEMP",
            planRootNumber: 0,
            publishDate: today,
            setDate: today,
            isTemp: true,
        });
        if (!response.data?.basket_id) throw new Error("Миний сагс үүсгэхэд алдаа гарлаа");
        return response.data.basket_id;
    }, [user.id]);

    const returnItemsToMyBasket = useCallback(async (itemIds) => {
        const basketItemIds = itemIds.map(toInteger).filter((id) => id > 0);
        if (!basketItemIds.length || basketItemIds.length !== itemIds.length) {
            throw new Error("Буцаах захиалгын дугаар буруу байна");
        }
        const targetBasketId = await ensureTempBasket();
        const response = await axios.put(`${API_BASE_URL}/put/UnpackBasketItems`, {
            basket_item_ids: basketItemIds,
            target_basket_id: toInteger(targetBasketId),
            user_id: toInteger(user.id),
        });
        const movedCount = Number(response.data?.moved_count || 0);
        if (movedCount !== basketItemIds.length) {
            throw new Error("Захиалгууд бүрэн буцаагдсангүй");
        }
        return movedCount;
    }, [ensureTempBasket, user.id]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [plansResult, basketsResult, usersResult, branchesResult, tendersResult] = await Promise.allSettled([
                axios.get(`${API_BASE_URL}/get/GetAll`),
                axios.get(`${API_BASE_URL}/get/basket`),
                axios.get(`${API_BASE_URL}/get/GetUsers`),
                axios.get(`${API_BASE_URL}/get/branches`),
                axios.get(`${API_BASE_URL}/get/GetTender`),
            ]);
            if (plansResult.status === "rejected") throw plansResult.reason;
            if (usersResult.status === "fulfilled") setUsers(usersResult.value.data || []);
            if (branchesResult.status === "fulfilled") setBranches(branchesResult.value.data || []);

            const tenderByBasketId = new Map();
            if (tendersResult.status === "fulfilled") {
                (tendersResult.value.data || []).forEach((tender) => {
                    parseBasketIds(tender.basket_ids).forEach((basketId) => {
                        if (!tenderByBasketId.has(basketId)) tenderByBasketId.set(basketId, tender);
                    });
                });
            } else {
                console.error("Plan tender information fetch failed:", tendersResult.reason);
            }

            const planMap = new Map();
            (plansResult.value.data || []).forEach((plan) => {
                const rootNumber = normalize(plan.plan_root_number);
                if (!rootNumber) return;
                const planKey = getPlanKey(rootNumber, plan.user_id);
                if (!planMap.has(planKey)) {
                    planMap.set(planKey, { ...plan, baskets: [] });
                }
                const targetPlan = planMap.get(planKey);
                (plan.baskets || []).forEach((basket) => {
                    const exists = targetPlan.baskets.some(
                        (entry) => String(entry.basket_id) === String(basket.basket_id)
                    );
                    if (!exists) targetPlan.baskets.push(basket);
                });
            });
            if (basketsResult.status === "fulfilled") {
                (basketsResult.value.data || [])
                    .filter((basket) => !basket.is_temp && normalize(basket.basket_type).toUpperCase() !== "TEMP")
                    .forEach((basket) => {
                        const rootNumber = normalize(basket.plan_root_number);
                        if (!rootNumber) return;
                        const planKey = getPlanKey(rootNumber, basket.user_id);
                        if (!planMap.has(planKey)) {
                            planMap.set(planKey, {
                                plan_root_number: basket.plan_root_number,
                                plan_name: basket.plan_name,
                                user_id: basket.user_id,
                                baskets: [],
                            });
                        }
                        const plan = planMap.get(planKey);
                        const exists = plan.baskets.some((entry) => String(entry.basket_id) === String(basket.basket_id));
                        if (!exists) plan.baskets.push({ ...basket, items: [] });
                    });
            }
            const allPlans = [...planMap.values()];
            const permittedPlans = isManager
                ? allPlans
                : allPlans.filter((plan) => String(plan.user_id) === String(user.id));

            const transformed = permittedPlans
                .map((planGroup) => {
                    const visibleBaskets = (planGroup.baskets || [])
                        .filter((basket) => normalize(basket.basket_type).toUpperCase() !== "TEMP" && !basket.is_temp);
                    const inboxBaskets = visibleBaskets.filter(
                        (basket) => normalize(basket.basket_type).toUpperCase() === PLAN_INBOX_TYPE
                    );
                    const inboxItems = inboxBaskets.flatMap((basket) => basket.items || []);
                    const baskets = visibleBaskets
                        .filter((basket) => normalize(basket.basket_type).toUpperCase() !== PLAN_INBOX_TYPE)
                        .map((basket) => {
                            const items = basket.items || [];
                            return {
                                key: `basket-${basket.basket_id}`,
                                basket_id: basket.basket_id,
                                basket_number: basket.basket_number,
                                basket_name: normalize(basket.basket_name) || "Нэргүй багц",
                                basket_type: normalize(basket.basket_type) || "Ангилалгүй",
                                plan_name: normalize(basket.plan_name),
                                plan_root_number: planGroup.plan_root_number,
                                user_id: planGroup.user_id,
                                set_date: basket.set_date,
                                publish_date: basket.publish_date,
                                total_price: items.reduce((sum, item) => sum + itemTotal(item), 0),
                                item_count: countConsolidatedOrders(items),
                                source_item_count: items.length,
                                items,
                                is_valid: Boolean(basket.is_valid),
                                tender: tenderByBasketId.get(String(basket.basket_id)) || null,
                            };
                        });

                    return {
                        key: `plan-${getPlanKey(planGroup.plan_root_number, planGroup.user_id)}`,
                        plan_root_number: planGroup.plan_root_number,
                        plan_name: normalize(planGroup.plan_name) || "Нэргүй төлөвлөгөө",
                        user_id: planGroup.user_id,
                        baskets,
                        inbox_items: inboxItems,
                        plan_years: [...new Set(visibleBaskets
                            .map((basket) => getDateYear(basket.publish_date) || getDateYear(basket.set_date))
                            .filter(Boolean))],
                        total_price: baskets.reduce((sum, basket) => sum + basket.total_price, 0),
                        item_count: baskets.reduce((sum, basket) => sum + basket.item_count, 0) + inboxItems.length,
                        pending_count: inboxItems.length,
                        ...getPlanTenderSummary(baskets),
                    };
                })
                .filter((plan) => plan.baskets.length > 0 || plan.inbox_items.length > 0)
                .sort((first, second) => first.plan_name.localeCompare(second.plan_name));

            setData(transformed);
        } catch (error) {
            console.error("Plan data fetch failed:", error);
            message.error("Төлөвлөгөөний мэдээлэл татахад алдаа гарлаа");
        } finally {
            setLoading(false);
        }
    }, [isManager, user.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const returnBasketToMyBasket = async (basket) => {
        try {
            const targetBasketId = await ensureTempBasket();
            const response = await axios.put(`${API_BASE_URL}/put/ReturnPlanBasket`, {
                basket_id: toInteger(basket.basket_id),
                target_basket_id: toInteger(targetBasketId),
                user_id: toInteger(user.id),
            });
            const movedCount = Number(response.data?.moved_count || 0);
            if (movedCount <= 0) throw new Error("Буцаасан захиалга олдсонгүй");
            setExpandedBasketKeys((keys) => keys.filter((key) => key !== basket.key));
            await loadData();
            message.success(`“${basket.basket_name}” багцын ${movedCount} захиалгыг Миний сагс → Багцалсан хэсэгт буцаалаа`);
            return true;
        } catch (error) {
            console.error("Plan basket return failed:", error);
            const responseMessage = typeof error.response?.data === "string"
                ? error.response.data
                : error.response?.data?.message || error.response?.data?.error;
            message.error(responseMessage || error.message || "Багцыг Миний сагс руу буцаахад алдаа гарлаа");
            return false;
        }
    };

    const handleReturnInboxToMyBasket = async (plan) => {
        const itemIds = plan.inbox_items.map(getItemId).filter(Boolean);
        if (!itemIds.length) {
            message.warning("Буцаах захиалга олдсонгүй");
            return;
        }

        setReturningInboxPlanKey(plan.key);
        try {
            const movedCount = await returnItemsToMyBasket(itemIds);
            if (normalize(assignmentPlan?.plan_root_number) === normalize(plan.plan_root_number)) {
                setAssignmentPlan(null);
            }
            await loadData();
            message.success(`${movedCount} захиалгыг Миний сагс → Багцлаагүй хэсэгт буцаалаа`);
        } catch (error) {
            console.error("Plan inbox return failed:", error);
            const responseMessage = typeof error.response?.data === "string"
                ? error.response.data
                : error.response?.data?.message || error.response?.data?.error;
            message.error(responseMessage || error.message || "Захиалга буцаахад алдаа гарлаа");
        } finally {
            setReturningInboxPlanKey("");
        }
    };

    const userMap = useMemo(
        () => new Map(users.map((entry) => [String(entry.id ?? entry.user_id), entry])),
        [users]
    );
    const getUserName = useCallback((id) => {
        const entry = userMap.get(String(id));
        if (!entry) return "—";
        return [entry.ovog, entry.ner].filter(Boolean).join(" ").trim()
            || normalize(entry.username)
            || "—";
    }, [userMap]);

    const yearOptions = useMemo(
        () => [...new Set(
            data.flatMap((plan) => plan.plan_years).filter(Boolean)
        )].sort((first, second) => second.localeCompare(first)),
        [data]
    );

    const yearFilteredData = useMemo(() => {
        if (activeYear === "all") return data;
        return data.flatMap((plan) => {
            const baskets = plan.baskets.filter((basket) =>
                (getDateYear(basket.publish_date) || getDateYear(basket.set_date)) === activeYear
            );
            const inboxItems = plan.inbox_items.filter((item) => {
                const itemYear = getItemYear(item);
                return itemYear ? itemYear === activeYear : plan.plan_years.includes(activeYear);
            });
            return baskets.length || inboxItems.length ? [{
                ...plan,
                baskets,
                inbox_items: inboxItems,
                total_price: baskets.reduce((sum, basket) => sum + basket.total_price, 0),
                item_count: baskets.reduce((sum, basket) => sum + basket.item_count, 0) + inboxItems.length,
                pending_count: inboxItems.length,
                ...getPlanTenderSummary(baskets),
            }] : [];
        });
    }, [activeYear, data]);

    const filteredData = useMemo(() => {
        const query = searchText.trim().toLocaleLowerCase();
        if (!query) return yearFilteredData;

        return yearFilteredData.flatMap((plan) => {
            const planMatches = [
                plan.plan_name,
                plan.plan_root_number,
                getUserName(plan.user_id),
                ...plan.tenders.map(getTenderLabel),
            ]
                .some((value) => normalize(value).toLocaleLowerCase().includes(query));
            if (planMatches) return [plan];

            const baskets = plan.baskets.filter((basket) => {
                const basketMatches = [
                    basket.basket_name,
                    basket.basket_number,
                    basket.set_date,
                    getTenderLabel(basket.tender),
                ].some((value) => normalize(value).toLocaleLowerCase().includes(query));
                const itemMatches = basket.items.some((item) => [
                    item.pkgno,
                    item.cr4name,
                    item.crmarkname,
                    item.crbrandname,
                    item.zno,
                    item.dname,
                ].some((value) => normalize(value).toLocaleLowerCase().includes(query)));
                return basketMatches || itemMatches;
            });
            const inboxItems = plan.inbox_items.filter((item) => [
                item.pkgno,
                item.cr4name,
                item.crmarkname,
                item.crbrandname,
                item.zno,
                item.dname,
            ].some((value) => normalize(value).toLocaleLowerCase().includes(query)));
            return baskets.length || inboxItems.length ? [{
                ...plan,
                baskets,
                inbox_items: inboxItems,
                total_price: baskets.reduce((sum, basket) => sum + basket.total_price, 0),
                item_count: baskets.reduce((sum, basket) => sum + basket.item_count, 0) + inboxItems.length,
                pending_count: inboxItems.length,
                ...getPlanTenderSummary(baskets),
            }] : [];
        });
    }, [getUserName, searchText, yearFilteredData]);

    const summary = useMemo(() => ({
        planCount: filteredData.length,
        basketCount: filteredData.reduce((sum, plan) => sum + plan.baskets.length, 0),
        itemCount: filteredData.reduce((sum, plan) => sum + plan.item_count, 0),
        pendingCount: filteredData.reduce((sum, plan) => sum + plan.pending_count, 0),
        assignedCount: filteredData.reduce(
            (sum, plan) => sum + plan.baskets.reduce((basketSum, basket) => basketSum + basket.item_count, 0),
            0
        ),
        readyPlanCount: filteredData.filter(
            (plan) => plan.available_basket_count > 0 && plan.pending_count === 0
        ).length,
        totalPrice: filteredData.reduce((sum, plan) => sum + plan.total_price, 0),
    }), [filteredData]);

    const assignmentBaskets = assignmentPlan?.baskets || [];
    const combinableGroups = useMemo(() => {
        const groups = new Map();
        (assignmentPlan?.inbox_items || []).forEach((item) => {
            const code = normalize(item.code);
            const price = toNumber(item.price);
            const itemId = getItemId(item);
            if (!code || !itemId) return;
            const key = `${code}::${price}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        });

        return [...groups.entries()]
            .filter(([, items]) => items.length > 1)
            .map(([key, items]) => ({
                key,
                code: normalize(items[0].code),
                name: normalize(items[0].cr4name) || "Нэргүй бараа",
                mark: normalize(items[0].crmarkname),
                unit: normalize(items[0].mname || items[0].usize),
                price: toNumber(items[0].price),
                quantity: items.reduce((sum, item) => sum + toNumber(item.qty), 0),
                total: items.reduce((sum, item) => sum + itemTotal(item), 0),
                departments: [...new Set(items.map((item) => normalize(item.dname)).filter(Boolean))],
                itemIds: items.map((item) => String(getItemId(item))),
            }))
            .sort((first, second) => second.itemIds.length - first.itemIds.length);
    }, [assignmentPlan]);
    const combinableItemIds = useMemo(
        () => new Set(combinableGroups.flatMap((group) => group.itemIds)),
        [combinableGroups]
    );
    const assignmentRows = useMemo(() => {
        const groups = new Map();
        (assignmentPlan?.inbox_items || []).forEach((item, index) => {
            const code = normalize(item.code);
            const price = toNumber(item.price);
            const key = code ? `${getConsolidationKey(item, index)}:price:${price}` : getConsolidationKey(item, index);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        });

        return [...groups.entries()].map(([key, items]) => {
            const first = items[0];
            return {
                ...first,
                key,
                itemIds: items.map(getItemId).filter(Boolean).map(String),
                combinedCount: items.length,
                qty: items.reduce((sum, item) => sum + toNumber(item.qty), 0),
                total: items.reduce((sum, item) => sum + itemTotal(item), 0),
                pkgno: [...new Set(items.map((item) => normalize(item.pkgno)).filter(Boolean))].join(", "),
                pkgname: [...new Set(items.map((item) => normalize(item.pkgname)).filter(Boolean))].join(", "),
                crbrandname: [...new Set(items.map((item) => normalize(item.crbrandname)).filter(Boolean))].join(", "),
                dname: [...new Set(items.map((item) => normalize(item.dname)).filter(Boolean))].join(", "),
            };
        });
    }, [assignmentPlan]);
    const selectedAssignmentGroupKeys = useMemo(() => {
        const selectedIds = new Set(selectedAssignmentIds.map(String));
        return assignmentRows
            .filter((row) => row.itemIds.length > 0 && row.itemIds.every((id) => selectedIds.has(id)))
            .map((row) => row.key);
    }, [assignmentRows, selectedAssignmentIds]);

    const openAssignmentModal = (plan) => {
        setAssignmentPlan(plan);
        setSelectedAssignmentIds([]);
        setAssignmentBasketId("");
    };

    const openStructureModal = () => {
        setStructureModalMode("basket");
        setNewBasketName("");
    };

    const toggleCombinableGroup = (group) => {
        const selected = new Set(selectedAssignmentIds.map(String));
        const allSelected = group.itemIds.every((id) => selected.has(id));
        group.itemIds.forEach((id) => {
            if (allSelected) selected.delete(id);
            else selected.add(id);
        });
        setSelectedAssignmentIds([...selected]);
    };

    const createDestinationBasket = async () => {
        const basketName = newBasketName.trim();
        if (!basketName) {
            message.warning("Багцын нэрийг оруулна уу");
            return;
        }
        const normalizedBasketName = basketName.toLocaleLowerCase();
        if (assignmentPlan.baskets.some((basket) =>
            normalize(basket.basket_name).toLocaleLowerCase() === normalizedBasketName
        )) {
            message.warning("Ижил нэртэй багц аль хэдийн байна");
            return;
        }

        const year = assignmentPlan.plan_years?.[0] || String(new Date().getFullYear());
        setStructureLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/post/addBasket`, {
                userId: user.id,
                planName: assignmentPlan.plan_name,
                planRootNumber: toInteger(assignmentPlan.plan_root_number),
                basketType: DEFAULT_BASKET_TYPE,
                basketName,
                basketNumber: assignmentPlan.baskets.length + 1,
                publishDate: `${year}-01-01`,
                setDate: `${year}-12-31`,
                isTemp: false,
            });
            const basketId = response.data?.basket_id;
            if (!basketId) throw new Error("Шинэ багцын дугаар буцаагдсангүй");

            const createdBasket = {
                key: `basket-${basketId}`,
                basket_id: basketId,
                basket_number: response.data?.basket_number || assignmentPlan.baskets.length + 1,
                basket_name: basketName,
                basket_type: DEFAULT_BASKET_TYPE,
                plan_name: assignmentPlan.plan_name,
                set_date: `${year}-12-31`,
                publish_date: `${year}-01-01`,
                total_price: 0,
                item_count: 0,
                items: [],
                is_valid: false,
            };
            setAssignmentPlan((current) => ({
                ...current,
                baskets: [...current.baskets, createdBasket],
            }));
            setAssignmentBasketId(basketId);
            setStructureModalMode("");
            setNewBasketName("");
            await loadData();
            message.success(`“${basketName}” багц үүслээ`);
        } catch (error) {
            console.error("Plan category/basket creation failed:", error);
            message.error(error.response?.data?.message || error.response?.data?.error || error.message || "Багц үүсгэхэд алдаа гарлаа");
        } finally {
            setStructureLoading(false);
        }
    };

    const assignOrdersToBasket = async () => {
        if (!selectedAssignmentIds.length) {
            message.warning("Хуваарилах захиалга сонгоно уу");
            return;
        }
        if (!assignmentBasketId) {
            message.warning("Багц сонгоно уу");
            return;
        }

        const selectedIdSet = new Set(selectedAssignmentIds.map(String));
        const selectedItems = assignmentPlan.inbox_items.filter((item) => selectedIdSet.has(String(getItemId(item))));
        const remainingPackageKeys = new Set(
            assignmentPlan.inbox_items
                .filter((item) => !selectedIdSet.has(String(getItemId(item))))
                .map(getPackageKey)
        );
        const completedPackages = [...new Map(
            selectedItems
                .filter((item) => item.pkgno && item.pkgdate && !remainingPackageKeys.has(getPackageKey(item)))
                .map((item) => [getPackageKey(item), { pkgno: item.pkgno, pkgdate: item.pkgdate }])
        ).values()];

        const assignmentPayload = {
            basket_item_ids: selectedAssignmentIds.map(toInteger).filter((id) => id > 0),
            target_basket_id: toInteger(assignmentBasketId),
            user_id: toInteger(user.id),
        };
        if (
            assignmentPayload.basket_item_ids.length !== selectedAssignmentIds.length
            || assignmentPayload.target_basket_id === 0
            || assignmentPayload.user_id === 0
        ) {
            message.error("Захиалга эсвэл багцын дугаар буруу байна. Мэдээллээ шинэчлээд дахин оролдоно уу");
            return;
        }

        setAssignmentLoading(true);
        try {
            const response = await axios.put(`${API_BASE_URL}/put/MoveBasketItems`, assignmentPayload);
            const movedCount = Number(response.data?.moved_count || 0);
            if (movedCount !== selectedAssignmentIds.length) throw new Error("Захиалгууд бүрэн хуваарилагдсангүй");

            const statusResults = await Promise.allSettled(
                completedPackages.map(({ pkgno, pkgdate }) => updateOrderStatus(pkgno, pkgdate, "2"))
            );
            const failedStatuses = statusResults.filter((result) => result.status === "rejected").length;
            await loadData();
            setAssignmentPlan(null);
            message.success(`${movedCount} захиалгыг багцад хуваариллаа${failedStatuses ? ` · ${failedStatuses} статус шинэчлэгдсэнгүй` : ""}`);
        } catch (error) {
            console.error("Plan order assignment failed:", {
                payload: assignmentPayload,
                status: error.response?.status,
                response: error.response?.data,
                error,
            });
            const responseMessage = typeof error.response?.data === "string"
                ? error.response.data
                : error.response?.data?.message || error.response?.data?.error;
            message.error(responseMessage || error.message || "Захиалга хуваарилахад алдаа гарлаа");
        } finally {
            setAssignmentLoading(false);
        }
    };

    const openTenderModal = async (plan) => {
        if ((plan?.inbox_items || []).length > 0) {
            message.warning("Хуваарилаагүй захиалгыг багцад бүрэн хуваарилсны дараа тендер үүсгэнэ");
            return;
        }

        setCurrentPlan(plan);
        setTenderNumber("");
        setSelectedBasketIds([]);
        setLockedBasketIds(
            plan.baskets.filter((basket) => basket.tender).map((basket) => String(basket.basket_id))
        );
        setBasketTenderMap(Object.fromEntries(
            plan.baskets
                .filter((basket) => basket.tender)
                .map((basket) => [String(basket.basket_id), getTenderLabel(basket.tender)])
        ));
        setTenderModalOpen(true);
        setTenderOptionsLoading(true);
        try {
            const response = await axios.get(
                `${API_BASE_URL}/get/GetBasketIdsByRootNum/${plan.plan_root_number}`
            );
            setLockedBasketIds((response.data?.basketIds || []).map(String));
            setBasketTenderMap(response.data?.basketTenderMap || {});
        } catch (error) {
            console.error("Tender basket locks fetch failed:", error);
            message.error("Тендерт орсон багцуудыг шалгахад алдаа гарлаа");
        } finally {
            setTenderOptionsLoading(false);
        }
    };

    const selectedTenderBaskets = useMemo(() => {
        const selected = new Set(selectedBasketIds.map(String));
        return (currentPlan?.baskets || []).filter((basket) => selected.has(String(basket.basket_id)));
    }, [currentPlan, selectedBasketIds]);
    const selectedTenderTotal = selectedTenderBaskets.reduce(
        (sum, basket) => sum + basket.total_price,
        0
    );

    const saveTender = async () => {
        if ((currentPlan?.inbox_items || []).length > 0) {
            message.warning("Хуваарилаагүй захиалгыг багцад бүрэн хуваарилсны дараа тендер үүсгэнэ");
            return;
        }

        const normalizedTenderNumber = tenderNumber.trim();
        if (!normalizedTenderNumber) {
            message.warning("Тендерийн дугаар оруулна уу");
            return;
        }
        if (!selectedTenderBaskets.length) {
            message.warning("Багц сонгоно уу");
            return;
        }
        if (selectedBasketIds.some((id) => lockedBasketIds.includes(String(id)))) {
            message.error("Сонгосон багцын зарим нь тендерт орсон байна");
            return;
        }

        const organization = [...new Set(
            selectedTenderBaskets.flatMap((basket) =>
                basket.items.map((item) => normalize(item.dname)).filter(Boolean)
            )
        )].join(", ");

        setTenderLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/post/PostTender`, {
                plan_root_number: currentPlan.plan_root_number,
                тендерийн_дугаар: normalizedTenderNumber,
                tender_name: currentPlan.plan_name,
                Organization: organization,
                Basket_Ids: selectedBasketIds.join(","),
                CreatedBy: user.id,
            });
            await loadData();
            message.success("Тендер амжилттай үүсгэгдлээ");
            setTenderModalOpen(false);
            setCurrentPlan(null);
            setSelectedBasketIds([]);
            setTenderNumber("");
        } catch (error) {
            console.error("Tender creation failed:", error);
            message.error(
                error.response?.data?.message
                || error.response?.data?.error
                || "Тендер үүсгэхэд алдаа гарлаа"
            );
        } finally {
            setTenderLoading(false);
        }
    };

    const deleteBasket = async (basket) => {
        if (basket.item_count > 0) {
            message.warning("Багцыг устгахын өмнө доторх захиалгуудыг хасна уу");
            return;
        }

        setDeletingBasketId(basket.basket_id);
        try {
            const tenderResponse = await axios.get(
                `${API_BASE_URL}/get/GetBasketIdsByRootNum/${basket.plan_root_number}`
            );
            const tenderBasketIds = (tenderResponse.data?.basketIds || []).map(String);
            if (tenderBasketIds.includes(String(basket.basket_id))) {
                message.error("Тендерт орсон багцыг устгах боломжгүй");
                return;
            }

            const response = await axios.delete(`${API_BASE_URL}/delete/deleteBasket`, {
                data: {
                    user_id: user.id,
                    basket_id: toInteger(basket.basket_id),
                },
                headers: { "Content-Type": "application/json" },
            });
            if (Number(response.data?.deleted_count || 0) < 1) {
                throw new Error("Багц олдсонгүй эсвэл устгах эрхгүй байна");
            }
            setExpandedBasketKeys((keys) => keys.filter((key) => key !== basket.key));
            await loadData();
            message.success(`“${basket.basket_name}” багц устгагдлаа`);
        } catch (error) {
            console.error("Basket deletion failed:", error);
            message.error(
                error.response?.data?.message
                || error.response?.data?.error
                || error.message
                || "Багц устгахад алдаа гарлаа"
            );
        } finally {
            setDeletingBasketId(null);
        }
    };

    const toggleBasketExpanded = (basket) => {
        if (!basket.items?.length) return;
        setExpandedBasketKeys((keys) => keys.includes(basket.key)
            ? keys.filter((key) => key !== basket.key)
            : [...keys, basket.key]);
    };

    const togglePlanExpanded = (plan) => {
        if (!plan.baskets?.length && !plan.inbox_items?.length) return;
        setExpandedPlanKeys((keys) => keys.includes(plan.key)
            ? keys.filter((key) => key !== plan.key)
            : [...keys, plan.key]);
    };

    const basketColumns = [
        { title: "№", dataIndex: "basket_number", key: "basket_number", width: 70, align: "center" },
        {
            title: "Багцын нэр",
            dataIndex: "basket_name",
            key: "basket_name",
            width: 280,
            ellipsis: true,
            render: (value, record) => {
                const isExpanded = expandedBasketKeys.includes(record.key);
                return (
                    <div className="plan-entity-cell">
                        <div className="plan-entity-title">
                            <FolderOpenOutlined
                                style={{
                                    color: isExpanded ? "#4d829f" : "#8c8c8c",
                                    fontSize: 16,
                                }}
                            />
                            <Text strong>{value}</Text>
                        </div>
                        <div className="plan-row-meta">
                            <Tag bordered={false} color={record.item_count > 0 ? "cyan" : "default"}>
                                {record.item_count} нэгтгэсэн захиалга
                            </Tag>
                            {record.source_item_count !== record.item_count && (
                                <Text type="secondary">{record.source_item_count} эх мөр</Text>
                            )}
                            {record.is_valid && <Tag bordered={false} color="success">Баталгаажсан</Tag>}
                        {record.tender && (
                            <Tag bordered={false} color="purple" icon={<LockOutlined />}>
                                {getTenderLabel(record.tender)}
                            </Tag>
                        )}
                        </div>
                    </div>
                );
            },
        },
        { title: "Зарлах огноо", dataIndex: "publish_date", key: "publish_date", width: 125, render: formatDate },
        { title: "Нээх огноо", dataIndex: "set_date", key: "set_date", width: 125, render: formatDate },
        {
            title: "Нийт үнэ",
            dataIndex: "total_price",
            key: "total_price",
            width: 155,
            align: "right",
            sorter: (first, second) => first.total_price - second.total_price,
            render: (value) => <Text strong>{formatNumber(value)} ₮</Text>,
        },
        {
            title: "Үйлдэл",
            key: "actions",
            width: 150,
            align: "center",
            fixed: "right",
            render: (_, record) => record.item_count > 0 ? (
                <Button
                    className="plan-open-detail-button"
                    size="small"
                    icon={expandedBasketKeys.includes(record.key) ? <DownOutlined /> : <RightOutlined />}
                    aria-expanded={expandedBasketKeys.includes(record.key)}
                    onClick={() => toggleBasketExpanded(record)}
                >
                    {expandedBasketKeys.includes(record.key) ? "Хураах" : "Дэлгэрэнгүй"}
                </Button>
            ) : !isManager ? (
                <Popconfirm
                    title="Багц устгах уу?"
                    description={`“${record.basket_name}” багцыг бүр мөсөн устгана.`}
                    okText="Устгах"
                    cancelText="Болих"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deleteBasket(record)}
                >
                    <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        loading={String(deletingBasketId) === String(record.basket_id)}
                    >
                        Устгах
                    </Button>
                </Popconfirm>
            ) : <Tag bordered={false}>Хоосон</Tag>,
        },
    ];

    const planColumns = [
        {
            title: "Төлөвлөгөө",
            dataIndex: "plan_name",
            key: "plan_name",
            ellipsis: true,
            sorter: (first, second) => first.plan_name.localeCompare(second.plan_name),
            render: (value, record) => {
                const isExpanded = expandedPlanKeys.includes(record.key);
                const assignedCount = record.baskets.reduce((sum, basket) => sum + basket.item_count, 0);
                const isExpandable = record.baskets.length > 0 || record.inbox_items.length > 0;
                return (
                    <div className="plan-entity-cell">
                        <div className="plan-entity-title plan-entity-title--plan">
                            <ProjectOutlined
                                style={{
                                    color: isExpanded ? "#4d829f" : "#8c8c8c",
                                    fontSize: 17,
                                }}
                            />
                            <Text strong style={{ fontSize: 15 }}>{value}</Text>
                            {isExpandable ? (
                                <span className="plan-expand-cue">
                                    {isExpanded ? <DownOutlined /> : <RightOutlined />}
                                    {isExpanded ? "Хураах" : "Багцуудыг нээх"}
                                </span>
                            ) : (
                                <span className="plan-expand-cue plan-expand-cue--empty">Хоосон</span>
                            )}
                        </div>
                        <div className="plan-row-meta">
                            <Tag bordered={false}>{record.baskets.length} багц</Tag>
                            <Tag bordered={false} color="cyan">{assignedCount} багцалсан</Tag>
                            {record.tendered_basket_count > 0 && (
                                <Tag bordered={false} color="purple">
                                    {record.tendered_basket_count} багц тендерт орсон
                                </Tag>
                            )}
                            {record.pending_count > 0 && <Tag color="gold">{record.pending_count} хуваарилаагүй</Tag>}
                            {record.pending_count === 0 && record.available_basket_count > 0 && (
                                <Tag bordered={false} color="success">Тендер үүсгэхэд бэлэн</Tag>
                            )}
                            {record.baskets.length > 0 && record.available_basket_count === 0 && (
                                <Tag bordered={false} color="success" icon={<CheckCircleOutlined />}>
                                    Бүх багц тендерт орсон
                                </Tag>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            title: "Нийт үнэ",
            dataIndex: "total_price",
            key: "total_price",
            width: 180,
            align: "right",
            sorter: (first, second) => first.total_price - second.total_price,
            render: (value) => <Text strong style={{ color: "#32735f" }}>{formatNumber(value)} ₮</Text>,
        },
        ...(isManager ? [{
            title: "Хариуцагч",
            dataIndex: "user_id",
            key: "user_id",
            width: 180,
            ellipsis: true,
            render: (value) => getUserName(value),
        }] : []),
        {
            title: "Үйлдэл",
            key: "actions",
            width: isManager ? 90 : 285,
            align: "center",
            fixed: "right",
            render: (_, record) => {
                const tenderLabels = record.tenders.map(getTenderLabel).filter(Boolean);
                return (
                <div className="plan-action-cell" onClick={(event) => event.stopPropagation()}>
                    {!isManager && record.available_basket_count > 0 && (
                        <div className="plan-action-cell__create">
                            <Tooltip
                                title={record.pending_count > 0
                                    ? "Хуваарилаагүй захиалгыг багцад бүрэн хуваарилсны дараа тендер үүсгэнэ"
                                    : ""}
                            >
                                <span>
                                    <Button
                                        className="plan-create-tender-button"
                                        type="primary"
                                        size="small"
                                        icon={<FileAddOutlined />}
                                        disabled={record.pending_count > 0}
                                        onClick={() => openTenderModal(record)}
                                    >
                                        {record.tender_count > 0 ? "Үлдсэн багцаар үүсгэх" : "Тендер үүсгэх"}
                                    </Button>
                                </span>
                            </Tooltip>
                            {record.tender_count > 0 && (
                                <small>{record.available_basket_count} багц үлдсэн</small>
                            )}
                        </div>
                    )}
                    {!isManager && record.baskets.length > 0 && record.available_basket_count === 0 && (
                        <div className="plan-tender-state" title={tenderLabels.join(", ")}>
                            <CheckCircleOutlined />
                            <span>
                                <strong>Тендерт орсон</strong>
                                <small>{tenderLabels.join(", ") || "Тендерийн мэдээлэл"}</small>
                            </span>
                        </div>
                    )}
                    <PrintIcon
                        normData={record}
                        planId={record.plan_root_number}
                        UserId={record.user_id}
                    />
                </div>
                );
            },
        },
    ];

    const renderBasketTable = (plan) => (
        <div className="plan-detail-panel">
            <div className="plan-detail-owner">
                <div className="plan-detail-owner__identity">
                    <ProjectOutlined />
                    <Text strong>{plan.plan_name}-ийн багцууд</Text>
                    <Tag color="blue">{plan.baskets.length} багц</Tag>
                </div>
                <Space size={16} wrap>
                    <Text type="secondary">Хариуцагч: {getUserName(plan.user_id)}</Text>
                    <Text type="secondary">{plan.item_count} захиалга</Text>
                    {plan.tender_count > 0 && (
                        <Tag color="purple">
                            {plan.tender_count} тендер · {plan.tendered_basket_count} багц орсон
                        </Tag>
                    )}
                    {plan.available_basket_count > 0 && (
                        <Tag color="green">{plan.available_basket_count} багц үлдсэн</Tag>
                    )}
                </Space>
            </div>
            {plan.inbox_items.length > 0 && (
                <div className="plan-inbox-panel">
                    <div className="plan-inbox-panel__content">
                        <span className="plan-inbox-panel__icon"><SwapOutlined /></span>
                        <div>
                            <Text strong>Хуваарилаагүй захиалга</Text>
                            <Text type="secondary">{plan.inbox_items.length} захиалгыг багцад хуваарилах шаардлагатай</Text>
                        </div>
                    </div>
                    <div className="plan-inbox-panel__actions">
                        {!isManager && (
                            <Popconfirm
                                title="Хуваарилаагүй захиалгуудыг буцаах уу?"
                                description="Захиалгууд Миний сагс → Багцлаагүй хэсэгт шилжинэ."
                                okText="Миний сагс руу буцаах"
                                cancelText="Болих"
                                onConfirm={() => handleReturnInboxToMyBasket(plan)}
                            >
                                <Button
                                    icon={<RollbackOutlined />}
                                    loading={returningInboxPlanKey === plan.key}
                                >
                                    Миний сагс руу буцаах
                                </Button>
                            </Popconfirm>
                        )}
                        <Button type="primary" icon={<SwapOutlined />} onClick={() => openAssignmentModal(plan)}>
                            Захиалга хуваарилах
                        </Button>
                    </div>
                </div>
            )}
            {plan.baskets.length > 0 ? (
            <Table
                columns={basketColumns}
                dataSource={plan.baskets}
                rowKey="key"
                size="small"
                pagination={false}
                scroll={{ x: isManager ? 760 : 870 }}
                expandable={{
                    expandedRowKeys: expandedBasketKeys,
                    showExpandColumn: false,
                    rowExpandable: (record) => record.items.length > 0,
                    expandedRowRender: (basket) => (
                        <div className="basket-detail-panel">
                            <ТөлөвлөгөөItemDetails
                                data={basket.items}
                                branches={branches}
                                onChanged={loadData}
                                onReturnToMyBasket={returnItemsToMyBasket}
                                onReturnWholeBasket={() => returnBasketToMyBasket(basket)}
                            />
                        </div>
                    ),
                }}
                onRow={(record) => ({
                    onClick: (event) => {
                        if (event.target.closest("button, a, input, .ant-dropdown")) return;
                        toggleBasketExpanded(record);
                    },
                    style: { cursor: record.items.length > 0 ? "pointer" : "default" },
                })}
                rowClassName={(record) => expandedBasketKeys.includes(record.key)
                    ? "plan-basket-row plan-basket-row--expanded"
                    : "plan-basket-row"}
            />
            ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Одоогоор багц үүсээгүй байна" />
            )}
        </div>
    );

    return (
        <>
            <div className="plan-office">
                <header className="plan-titlebar">
                    <div className="plan-titlebar__identity">
                        <span className="plan-titlebar__icon"><ProjectOutlined /></span>
                        <div>
                            <h1>Худалдан авах төлөвлөгөө</h1>
                        </div>
                    </div>
                    <div className="plan-titlebar__summary">
                        <span className="plan-summary-chip"><strong>{summary.planCount}</strong> төлөвлөгөө</span>
                        <span className="plan-summary-chip"><strong>{summary.basketCount}</strong> багц</span>
                        <span className="plan-summary-chip"><strong>{summary.itemCount}</strong> захиалга</span>
                        <span className="plan-summary-chip plan-summary-chip--price"><strong>{formatNumber(summary.totalPrice)} ₮</strong></span>
                    </div>
                </header>

                <section className="plan-workflow-strip" aria-label="Төлөвлөгөөний ажлын дараалал">
                    <div className={`plan-workflow-step ${summary.pendingCount > 0 ? "is-warning" : "is-complete"}`}>
                        <span className="plan-workflow-step__number">1</span>
                        <div>
                            <strong>Захиалга хуваарилах</strong>
                            <small>{summary.pendingCount > 0 ? `${summary.pendingCount} захиалга хүлээгдэж байна` : "Хуваарилаагүй захиалга байхгүй"}</small>
                        </div>
                    </div>
                    <RightOutlined className="plan-workflow-arrow" />
                    <div className="plan-workflow-step is-active">
                        <span className="plan-workflow-step__number">2</span>
                        <div>
                            <strong>Багцыг шалгах</strong>
                            <small>{summary.basketCount} багц · {summary.assignedCount} нэгтгэсэн захиалга</small>
                        </div>
                    </div>
                    <RightOutlined className="plan-workflow-arrow" />
                    <div className={`plan-workflow-step ${summary.readyPlanCount > 0 ? "is-ready" : ""}`}>
                        <span className="plan-workflow-step__number">3</span>
                        <div>
                            <strong>Тендер үүсгэх</strong>
                            <small>{summary.readyPlanCount} төлөвлөгөө бэлэн</small>
                        </div>
                    </div>
                </section>

                <section className="plan-commandbar">
                    <div className="plan-commandbar__primary">
                        <div className="plan-year-filter">
                            <CalendarOutlined />
                            <Button
                                className={`plan-year-button ${activeYear === "all" ? "is-active" : ""}`}
                                onClick={() => setActiveYear("all")}
                            >
                                Бүгд
                            </Button>
                            {yearOptions.map((year) => (
                                <Button
                                    key={year}
                                    className={`plan-year-button ${activeYear === year ? "is-active" : ""}`}
                                    onClick={() => setActiveYear(year)}
                                >
                                    {year}
                                </Button>
                            ))}
                        </div>
                        <Input
                            allowClear
                            className="plan-commandbar__search"
                            prefix={<SearchOutlined />}
                            placeholder="Төлөвлөгөө, багц, бараа, албаар хайх..."
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                        />
                    </div>
                    <div className="plan-commandbar__actions">
                        {expandedPlanKeys.length > 0 && (
                            <Button
                                className="plan-command-button"
                                onClick={() => {
                                    setExpandedPlanKeys([]);
                                    setExpandedBasketKeys([]);
                                }}
                            >
                                Бүгдийг хураах
                            </Button>
                        )}
                        <Button
                            className="plan-command-button"
                            icon={<ReloadOutlined />}
                            onClick={loadData}
                            loading={loading}
                        >
                            Шинэчлэх
                        </Button>
                    </div>
                </section>

                <section className="plan-workspace">
                    <Spin spinning={loading} tip="Төлөвлөгөө уншиж байна...">
                        <Table
                            className="plan-main-table"
                            columns={planColumns}
                            dataSource={filteredData}
                            rowKey="key"
                            sticky
                            pagination={{
                                defaultPageSize: 10,
                                pageSizeOptions: [5, 10, 20, 50],
                                showSizeChanger: true,
                                showTotal: (total, range) => `${range[0]}–${range[1]} / ${total}`,
                                position: ["bottomCenter"],
                            }}
                            scroll={{ x: 980 }}
                            expandable={{
                                expandedRowKeys: expandedPlanKeys,
                                showExpandColumn: false,
                                rowExpandable: (record) => record.baskets.length > 0 || record.inbox_items.length > 0,
                                expandedRowRender: renderBasketTable,
                            }}
                            onRow={(record) => ({
                                onClick: (event) => {
                                    if (event.target.closest("button, a, input, .ant-dropdown")) return;
                                    togglePlanExpanded(record);
                                },
                                style: {
                                    cursor: record.baskets.length > 0 || record.inbox_items.length > 0
                                        ? "pointer"
                                        : "default",
                                },
                            })}
                            rowClassName={(record) => expandedPlanKeys.includes(record.key)
                                ? "plan-root-row plan-root-row--expanded"
                                : "plan-root-row"}
                            locale={{ emptyText: <Empty description={searchText ? "Хайлтад тохирох төлөвлөгөө олдсонгүй" : "Төлөвлөгөө байхгүй"} /> }}
                        />
                    </Spin>
                    <footer className="plan-statusbar">
                        <span>{activeYear === "all" ? "Бүх он" : `${activeYear} он`} · Харагдаж буй: <strong>{summary.planCount}</strong> төлөвлөгөө</span>
                        <span>Нээгдсэн: <strong>{expandedPlanKeys.length}</strong></span>
                    </footer>
                </section>
            </div>

            <Modal
                title="Захиалгыг багцад хуваарилах"
                open={Boolean(assignmentPlan)}
                onCancel={() => setAssignmentPlan(null)}
                onOk={assignOrdersToBasket}
                okText={`Хуваарилах (${selectedAssignmentIds.length})`}
                cancelText="Болих"
                confirmLoading={assignmentLoading}
                okButtonProps={{ disabled: !selectedAssignmentIds.length || !assignmentBasketId }}
                width={1040}
                centered
                destroyOnHidden
                className="plan-order-assignment-modal"
            >
                <div className="plan-order-assignment-modal__destination">
                    <div>
                        <Text type="secondary">Төлөвлөгөө</Text>
                        <Text strong>{assignmentPlan?.plan_name}</Text>
                    </div>
                    <div className="plan-destination-field">
                        <span>Багц</span>
                        <div className="plan-destination-field__control">
                            <Select
                                placeholder="Багц сонгох"
                                value={assignmentBasketId || undefined}
                                options={assignmentBaskets.map((basket) => ({
                                    label: basket.basket_name,
                                    value: basket.basket_id,
                                }))}
                                onChange={setAssignmentBasketId}
                                optionFilterProp="label"
                                showSearch
                            />
                            <Button
                                icon={<PlusOutlined />}
                                onClick={openStructureModal}
                            >
                                Үүсгэх
                            </Button>
                        </div>
                    </div>
                </div>
                {combinableGroups.length > 0 && (
                    <section className="combinable-orders">
                        <div className="combinable-orders__heading">
                            <div>
                                <Text strong>Нэг багцад оруулж болох захиалгууд</Text>
                                <Text type="secondary">Ижил код болон ижил нэгж үнэтэй захиалгууд</Text>
                            </div>
                            <Tag color="green">{combinableGroups.length} бүлэг</Tag>
                        </div>
                        <div className="combinable-orders__list">
                            {combinableGroups.map((group) => {
                                const allSelected = group.itemIds.every((id) => selectedAssignmentIds.map(String).includes(id));
                                return (
                                    <button
                                        type="button"
                                        key={group.key}
                                        className={`combinable-order-card ${allSelected ? "is-selected" : ""}`}
                                        onClick={() => toggleCombinableGroup(group)}
                                    >
                                        <span className="combinable-order-card__icon"><SwapOutlined /></span>
                                        <span className="combinable-order-card__product">
                                            <strong>{group.name}{group.mark ? ` · ${group.mark}` : ""}</strong>
                                            <small>{group.code} · {group.departments.join(", ")}</small>
                                        </span>
                                        <span className="combinable-order-card__summary">
                                            <strong>{group.itemIds.length} захиалга</strong>
                                            <small>{formatNumber(group.quantity)} {group.unit || "нэгж"} · {formatNumber(group.price)} ₮/нэгж</small>
                                        </span>
                                        <span className="combinable-order-card__action">
                                            {allSelected ? "Сонгосон" : "Бүгдийг сонгох"}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}
                <Table
                    rowKey="key"
                    dataSource={assignmentRows}
                    columns={[
                        { title: "Барааны нэр", dataIndex: "cr4name", key: "cr4name", width: 220, ellipsis: true },
                        { title: "Марк", dataIndex: "crmarkname", key: "crmarkname", width: 180, ellipsis: true },
                        {
                            title: "Брэнд",
                            dataIndex: "crbrandname",
                            key: "crbrandname",
                            width: 160,
                            ellipsis: true,
                            render: (value) => value || "-",
                        },
                        {
                            title: "Захиалгын багц",
                            key: "pkgname",
                            width: 190,
                            ellipsis: true,
                            render: (_, item) => item.pkgname || item.pkgno || "-",
                        },
                        { title: "Алба", dataIndex: "dname", key: "dname", width: 130, ellipsis: true },
                        {
                            title: "Нэгтгэх",
                            key: "combinable",
                            width: 105,
                            align: "center",
                            render: (_, item) => item.combinedCount > 1
                                ? <Tag color="green">{item.combinedCount} нийлсэн</Tag>
                                : combinableItemIds.has(String(getItemId(item)))
                                    ? <Tag color="green">Болно</Tag>
                                : <Text type="secondary">—</Text>,
                        },
                        { title: "Тоо", dataIndex: "qty", key: "qty", width: 85, align: "right", render: formatNumber },
                        { title: "Нийт үнэ", dataIndex: "total", key: "total", width: 140, align: "right", render: (value) => `${formatNumber(value)} ₮` },
                    ]}
                    rowSelection={{
                        selectedRowKeys: selectedAssignmentGroupKeys,
                        onChange: (keys) => {
                            const selectedKeys = new Set(keys);
                            setSelectedAssignmentIds(
                                assignmentRows
                                    .filter((row) => selectedKeys.has(row.key))
                                    .flatMap((row) => row.itemIds)
                            );
                        },
                        selections: [Table.SELECTION_ALL, Table.SELECTION_NONE],
                    }}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    scroll={{ x: 1180, y: 390 }}
                    size="small"
                    rowClassName={(record) => combinableItemIds.has(String(getItemId(record))) ? "combinable-order-row" : ""}
                />
            </Modal>

            <Modal
                title="Шинэ багц үүсгэх"
                open={Boolean(structureModalMode)}
                onCancel={() => setStructureModalMode("")}
                onOk={createDestinationBasket}
                okText="Үүсгэх"
                cancelText="Болих"
                confirmLoading={structureLoading}
                okButtonProps={{ disabled: !newBasketName.trim() }}
                width={520}
                centered
                destroyOnHidden
            >
                <div className="plan-structure-create-form">
                    <label>
                        <span>Багцын нэр</span>
                        <Input
                            value={newBasketName}
                            placeholder="Жишээ: Компьютер, дагалдах хэрэгсэл"
                            onChange={(event) => setNewBasketName(event.target.value)}
                            onPressEnter={createDestinationBasket}
                            autoFocus
                        />
                    </label>
                    <Text type="secondary">Шинэ багц сонгогдсон төлөвлөгөөнд үүсээд автоматаар сонгогдоно.</Text>
                </div>
            </Modal>

            <Modal
                rootClassName="plan-tender-modal"
                title="Тендер үүсгэх"
                open={tenderModalOpen}
                onOk={saveTender}
                onCancel={() => setTenderModalOpen(false)}
                okText="Тендер үүсгэх"
                cancelText="Болих"
                confirmLoading={tenderLoading}
                okButtonProps={{ disabled: tenderOptionsLoading || !selectedBasketIds.length }}
                width={720}
                centered
                destroyOnHidden
            >
                <div className="plan-tender-modal__context">
                    <div>
                        <Text type="secondary">Төлөвлөгөө</Text>
                        <Text strong>{currentPlan?.plan_name || "—"}</Text>
                    </div>
                    <Space wrap size={[6, 6]}>
                        {(currentPlan?.tenders || []).map((tender) => (
                            <Tag key={tender.tender_id || getTenderLabel(tender)} color="purple" icon={<CheckCircleOutlined />}>
                                {getTenderLabel(tender)}
                            </Tag>
                        ))}
                        <Tag color="green">{currentPlan?.available_basket_count || 0} багц боломжтой</Tag>
                    </Space>
                </div>
                <Input
                    placeholder={currentPlan?.tender_count > 0 ? "Шинэ тендерийн дугаар" : "Тендерийн дугаар"}
                    value={tenderNumber}
                    onChange={(event) => setTenderNumber(event.target.value)}
                    style={{ marginBottom: 14 }}
                />

                <Card size="small" style={{ marginBottom: 14 }}>
                    <Space wrap size={18}>
                        <Text type="secondary">Сонгосон:</Text>
                        <Text strong>{selectedTenderBaskets.length} багц</Text>
                        <Text strong style={{ color: "#32735f" }}>{formatNumber(selectedTenderTotal)} ₮</Text>
                    </Space>
                </Card>

                <Spin spinning={tenderOptionsLoading}>
                    <Checkbox.Group
                        value={selectedBasketIds}
                        onChange={setSelectedBasketIds}
                        style={{ width: "100%" }}
                    >
                        <Space direction="vertical" style={{ width: "100%" }}>
                            {(currentPlan?.baskets || []).map((basket) => {
                                const basketId = String(basket.basket_id);
                                const locked = lockedBasketIds.includes(basketId);
                                return (
                                    <Card
                                        key={basket.key}
                                        size="small"
                                        styles={{ body: { padding: "10px 12px" } }}
                                        style={{ width: "100%", opacity: locked ? 0.65 : 1 }}
                                    >
                                        <Checkbox value={basketId} disabled={locked} style={{ width: "100%" }}>
                                            <Space direction="vertical" size={2}>
                                                <Space wrap>
                                                    <Text strong>{basket.basket_name}</Text>
                                                    <Tag bordered={false}>{basket.item_count} захиалга</Tag>
                                                    <Text>{formatNumber(basket.total_price)} ₮</Text>
                                                </Space>
                                                {locked && (
                                                    <Text type="danger">
                                                        <LockOutlined /> Тендерт орсон: {basketTenderMap[basket.basket_id] || basketTenderMap[basketId] || "—"}
                                                    </Text>
                                                )}
                                            </Space>
                                        </Checkbox>
                                    </Card>
                                );
                            })}
                        </Space>
                    </Checkbox.Group>
                </Spin>
            </Modal>
        </>
    );
};

export default ТөлөвлөгөөTable;
