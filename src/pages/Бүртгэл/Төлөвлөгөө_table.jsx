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
    DeleteOutlined,
    FileAddOutlined,
    FolderOpenOutlined,
    LockOutlined,
    ProjectOutlined,
    PlusOutlined,
    ReloadOutlined,
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
const getConsolidationKey = (item, index = 0) => {
    const code = normalize(item.code);
    return code ? `code:${code}` : `item:${normalize(getItemId(item)) || index}`;
};
const countConsolidatedOrders = (items) => new Set(
    items.map((item, index) => getConsolidationKey(item, index))
).size;
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
            const [plansResult, basketsResult, usersResult, branchesResult] = await Promise.allSettled([
                axios.get(`${API_BASE_URL}/get/GetAll`),
                axios.get(`${API_BASE_URL}/get/basket`),
                axios.get(`${API_BASE_URL}/get/GetUsers`),
                axios.get(`${API_BASE_URL}/get/branches`),
            ]);
            if (plansResult.status === "rejected") throw plansResult.reason;
            if (usersResult.status === "fulfilled") setUsers(usersResult.value.data || []);
            if (branchesResult.status === "fulfilled") setBranches(branchesResult.value.data || []);

            const planMap = new Map(
                (plansResult.value.data || []).map((plan) => [
                    normalize(plan.plan_root_number),
                    { ...plan, baskets: [...(plan.baskets || [])] },
                ])
            );
            if (basketsResult.status === "fulfilled") {
                (basketsResult.value.data || [])
                    .filter((basket) => !basket.is_temp && normalize(basket.basket_type).toUpperCase() !== "TEMP")
                    .forEach((basket) => {
                        const rootKey = normalize(basket.plan_root_number);
                        if (!rootKey) return;
                        if (!planMap.has(rootKey)) {
                            planMap.set(rootKey, {
                                plan_root_number: basket.plan_root_number,
                                plan_name: basket.plan_name,
                                user_id: basket.user_id,
                                baskets: [],
                            });
                        }
                        const plan = planMap.get(rootKey);
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
                            };
                        });

                    return {
                        key: `plan-${planGroup.plan_root_number}`,
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
            }] : [];
        });
    }, [activeYear, data]);

    const filteredData = useMemo(() => {
        const query = searchText.trim().toLocaleLowerCase();
        if (!query) return yearFilteredData;

        return yearFilteredData.flatMap((plan) => {
            const planMatches = [plan.plan_name, plan.plan_root_number, getUserName(plan.user_id)]
                .some((value) => normalize(value).toLocaleLowerCase().includes(query));
            if (planMatches) return [plan];

            const baskets = plan.baskets.filter((basket) => {
                const basketMatches = [
                    basket.basket_name,
                    basket.basket_number,
                    basket.set_date,
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
            }] : [];
        });
    }, [getUserName, searchText, yearFilteredData]);

    const summary = useMemo(() => ({
        planCount: filteredData.length,
        basketCount: filteredData.reduce((sum, plan) => sum + plan.baskets.length, 0),
        itemCount: filteredData.reduce((sum, plan) => sum + plan.item_count, 0),
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
        setCurrentPlan(plan);
        setTenderNumber("");
        setSelectedBasketIds([]);
        setLockedBasketIds([]);
        setBasketTenderMap({});
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
            message.success("Тендер амжилттай үүсгэгдлээ");
            setTenderModalOpen(false);
            setCurrentPlan(null);
            setSelectedBasketIds([]);
            setTenderNumber("");
        } catch (error) {
            console.error("Tender creation failed:", error);
            message.error(error.response?.data?.message || "Тендер үүсгэхэд алдаа гарлаа");
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

    const basketColumns = [
        { title: "№", dataIndex: "basket_number", key: "basket_number", width: 70, align: "center" },
        {
            title: "Багцын нэр",
            dataIndex: "basket_name",
            key: "basket_name",
            width: 280,
            ellipsis: true,
            render: (value, record) => (
                <Space direction="vertical" size={3}>
                    <Space size={8}>
                        <FolderOpenOutlined
                            style={{
                                color: expandedBasketKeys.includes(record.key) ? "#4d829f" : "#8c8c8c",
                                fontSize: 16,
                            }}
                        />
                        <Text strong>{value}</Text>
                    </Space>
                    <Text type="secondary">{record.item_count} захиалга</Text>
                </Space>
            ),
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
        ...(!isManager ? [{
            title: "Үйлдэл",
            key: "actions",
            width: 110,
            align: "center",
            fixed: "right",
            render: (_, record) => record.item_count > 0 ? (
                <Tooltip title="Эхлээд багц доторх захиалгуудыг хасна уу">
                    <Button size="small" danger icon={<DeleteOutlined />} disabled>
                        Устгах
                    </Button>
                </Tooltip>
            ) : (
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
            ),
        }] : []),
    ];

    const planColumns = [
        {
            title: "Төлөвлөгөө",
            dataIndex: "plan_name",
            key: "plan_name",
            ellipsis: true,
            sorter: (first, second) => first.plan_name.localeCompare(second.plan_name),
            render: (value, record) => (
                <Space direction="vertical" size={3}>
                    <Space size={9}>
                        <ProjectOutlined
                            style={{
                                color: expandedPlanKeys.includes(record.key) ? "#4d829f" : "#8c8c8c",
                                fontSize: 17,
                            }}
                        />
                        <Text strong style={{ fontSize: 15 }}>{value}</Text>
                    </Space>
                    <Space size={6} wrap>
                        <Tag bordered={false}>{record.baskets.length} багц</Tag>
                        <Text type="secondary">{record.item_count} захиалга</Text>
                        {record.pending_count > 0 && <Tag color="gold">{record.pending_count} хуваарилаагүй</Tag>}
                    </Space>
                </Space>
            ),
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
            width: isManager ? 90 : 230,
            align: "center",
            fixed: "right",
            render: (_, record) => (
                <Space onClick={(event) => event.stopPropagation()}>
                    {!isManager && (
                        <Button
                            className="plan-create-tender-button"
                            type="primary"
                            size="small"
                            icon={<FileAddOutlined />}
                            onClick={() => openTenderModal(record)}
                        >
                            Тендер үүсгэх
                        </Button>
                    )}
                    <PrintIcon
                        normData={record}
                        planId={record.plan_root_number}
                        UserId={record.user_id}
                    />
                </Space>
            ),
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
                            <div className="basket-detail-owner">
                                <div className="basket-detail-owner__identity">
                                    <FolderOpenOutlined />
                                    <Text strong>
                                        {basket.basket_name}-ийн захиалгууд
                                    </Text>
                                    <Tag color="cyan">{basket.item_count} захиалга</Tag>
                                </div>
                                <Text type="secondary">Төлөвлөгөө: {plan.plan_name}</Text>
                            </div>
                            <ТөлөвлөгөөItemDetails
                                data={basket.items}
                                branches={branches}
                                onChanged={loadData}
                                onReturnToMyBasket={returnItemsToMyBasket}
                            />
                        </div>
                    ),
                }}
                onRow={(record) => ({
                    onClick: (event) => {
                        if (event.target.closest("button, a, input, .ant-dropdown")) return;
                        setExpandedBasketKeys((keys) => keys.includes(record.key)
                            ? keys.filter((key) => key !== record.key)
                            : [...keys, record.key]);
                    },
                    style: { cursor: "pointer" },
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
                            scroll={{ x: 850 }}
                            expandable={{
                                expandedRowKeys: expandedPlanKeys,
                                showExpandColumn: false,
                                rowExpandable: (record) => record.baskets.length > 0 || record.inbox_items.length > 0,
                                expandedRowRender: renderBasketTable,
                            }}
                            onRow={(record) => ({
                                onClick: (event) => {
                                    if (event.target.closest("button, a, input, .ant-dropdown")) return;
                                    setExpandedPlanKeys((keys) => keys.includes(record.key)
                                        ? keys.filter((key) => key !== record.key)
                                        : [...keys, record.key]);
                                },
                                style: { cursor: "pointer" },
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
                    scroll={{ x: 1020, y: 390 }}
                    size="small"
                    rowClassName={(record) => combinableItemIds.has(String(getItemId(record))) ? "combinable-order-row" : ""}
                />
            </Modal>

            <Modal
                title="Шинэ багц үүсгэх"
                open={Boolean(structureModalMode)}
                onCancel={() => setStructureModalMode("")}
                onOk={createDestinationBasket}
                okText="Үүсгээд сонгох"
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
                <Input
                    placeholder="Тендерийн дугаар"
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
