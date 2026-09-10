import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Button, message, Spin, Tabs, Modal } from "antd";
import {
    AppstoreAddOutlined,
    DisconnectOutlined,
    InboxOutlined,
    LockOutlined,
    ProjectOutlined,
    RollbackOutlined,
    ShoppingCartOutlined,
    UnorderedListOutlined,
    UnlockOutlined,
    UserOutlined,
} from "@ant-design/icons";
import Table from "./Table";
import axios from "axios";
import PlanAssignmentModal, { PLAN_INBOX_TYPE } from "./PlanAssignmentModal";
import ReturnOrderForm from "./ReturnOrderForm";
import { fetchOrders, fetchOrdersToken, returnOrder } from "../../api/orders";
import {
    createBasketItemPayload,
    getOrderIdentity,
    getOrderOwnershipIdentity,
    getOrderMonth,
    getOrderRowKey,
    getOrderYear,
    normalizeExternalOrder,
} from "./order.utils";
import "./Багцлах.css";

const currentDate = new Date();
const currentYear = String(currentDate.getFullYear());
const years = ["2025", "2026", "2027"];
const months = Array.from({ length: 12 }, (_, index) => index + 1);
const isInvalidTokenResponse = (response) =>
    String(response?.data?.message || "").toLowerCase().includes("token incorrect");
const flattenRows = (rows) => rows.flatMap((row) => row.items?.length ? row.items : [row]);
const getPackageIdentity = (item) =>
    `${String(item.pkgno?.String ?? item.pkgno ?? "").trim()}-${String(item.pkgdate?.String ?? item.pkgdate ?? "").trim()}`;

const Багцлах = () => {
    const user = useMemo(() => {
        try {
            const userJson = localStorage.getItem("data");
            return userJson ? JSON.parse(userJson) : null;
        } catch {
            return null;
        }
    }, []);

    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedRows, setSelectedRows] = useState([]);
    const [selectionResetToken, setSelectionResetToken] = useState(0);
    const [allData, setAllData] = useState([]);
    const [yourOrders, setYourOrders] = useState([]);
    const [packagedOrders, setPackagedOrders] = useState([]);
    const [returnedOrders, setReturnedOrders] = useState([]);
    const [activeSection, setActiveSection] = useState("all");
    const [mineOrderStatus, setMineOrderStatus] = useState("unpackaged");
    const [activeYear, setActiveYear] = useState(currentYear);
    const [activeMonths, setActiveMonths] = useState([]);
    const [ownershipFilter, setOwnershipFilter] = useState("all");

    const API_BASE_URL = import.meta.env.VITE_API_URL;
    const ordersByYear = useRef(new Map());
    const ordersToken = useRef("");
    const stagedOrders = useRef([]);
    const tempBasketId = useRef(null);
    const loadBasketStateRef = useRef(null);

    useEffect(() => {
        stagedOrders.current = yourOrders;
    }, [yourOrders]);

    // ✅ Fetch token and cache it in localStorage
    const fetchToken = useCallback(async () => {
        try {
            const token = await fetchOrdersToken();
            ordersToken.current = token || "";
            return token;
        } catch (err) {
            message.error("Токен авахад алдаа гарлаа");
            console.error("Token fetch error:", err);
            return null;
        }
    }, []);


    // ✅ Fetch and merge data efficiently
    const fetchData = useCallback(
        async (yy) => {
            const cachedOrders = ordersByYear.current.get(yy);
            if (cachedOrders) {
                setLoading(true);
                try {
                    const { userItems, allItems } = await loadBasketStateRef.current();
                    const ownKeys = new Set(userItems.map(getOrderOwnershipIdentity));
                    const stagedKeys = new Set(stagedOrders.current.map(getOrderIdentity));
                    const claimedOwners = new Map();
                    allItems.forEach((item) => {
                        if (String(item.userId) === String(user?.id)) return;
                        const ownerName = [item.ownerOvog, item.ownerNer]
                            .filter(Boolean)
                            .join(" ") || item.ownerUsername || "Нэргүй хэрэглэгч";
                        claimedOwners.set(getOrderOwnershipIdentity(item), ownerName);
                    });
                    setAllData(cachedOrders
                        .filter((item) => !ownKeys.has(getOrderOwnershipIdentity(item)) && !stagedKeys.has(getOrderIdentity(item)))
                        .map((item) => ({
                            ...item,
                            isLocked: claimedOwners.has(getOrderOwnershipIdentity(item)),
                            claimedBy: claimedOwners.get(getOrderOwnershipIdentity(item)) || "",
                        })));
                } finally {
                    setLoading(false);
                }
                return;
            }

            setLoading(true);

            let validToken = ordersToken.current;

            try {
                // 1️⃣ ensure token
                if (!validToken) {
                    validToken = await fetchToken();
                    if (!validToken) throw new Error("Token not received");
                }

                // 2️⃣ call orders API
                let ordersRes = await fetchOrders(yy, "0", validToken);

                // 🔁 token invalid → retry once
                if (isInvalidTokenResponse(ordersRes)) {
                    validToken = await fetchToken();
                    if (!validToken) throw new Error("Token refresh failed");

                    ordersRes = await fetchOrders(yy, "0", validToken);
                }

                if (!ordersRes.data?.status) {
                    if (isInvalidTokenResponse(ordersRes)) {
                        ordersToken.current = "";
                    }
                    throw new Error(ordersRes.data?.message || "Orders API error");
                }

                // 3️⃣ reload local basket state
                const { userItems: filteredItems, allItems } = await loadBasketStateRef.current();
                const basketKeys = new Set(filteredItems.map(getOrderOwnershipIdentity));
                const claimedOwners = new Map();
                allItems.forEach((item) => {
                    if (String(item.userId) === String(user?.id)) return;
                    const ownerName = [item.ownerOvog, item.ownerNer]
                        .filter(Boolean)
                        .join(" ") || item.ownerUsername || "Нэргүй хэрэглэгч";
                    claimedOwners.set(getOrderOwnershipIdentity(item), ownerName);
                });

                // 4️⃣ filter out basket items
                let orders = (ordersRes.data.records || []).map(normalizeExternalOrder);
                const stagedKeys = new Set(stagedOrders.current.map(getOrderIdentity));
                orders = orders.filter((order) => {
                    const identity = getOrderIdentity(order);
                    return !basketKeys.has(getOrderOwnershipIdentity(order)) && !stagedKeys.has(identity);
                });

                // 5️⃣ normalize records
                const recordsWithKey = orders.map((rec, idx) => ({
                    ...rec,
                    key: getOrderRowKey(rec, yy, getOrderMonth(rec) || "unknown", idx),
                    year: yy,
                    month: getOrderMonth(rec),
                    isLocked: claimedOwners.has(getOrderOwnershipIdentity(rec)),
                    claimedBy: claimedOwners.get(getOrderOwnershipIdentity(rec)) || "",
                }));

                // 6️⃣ cache the complete year; month buttons only filter this data
                ordersByYear.current.set(yy, recordsWithKey);
                setAllData(recordsWithKey);

            } catch (err) {
                console.error("fetchData error:", err);
                message.error("Захиалгын мэдээлэл татахад алдаа гарлаа");
            } finally {
                setLoading(false);
            }
        },
        [fetchToken, user?.id]
    );

    useEffect(() => {
        (async () => {
            await fetchData(currentYear);
        })();
    }, [fetchData]);


    const resetSelection = useCallback(() => {
        setSelectedRows([]);
        setSelectionResetToken((token) => token + 1);
    }, []);

    const loadBasketState = useCallback(async () => {
        const [basketResponse, itemResponse] = await Promise.all([
            axios.get(`${API_BASE_URL}/get/basket`),
            axios.get(`${API_BASE_URL}/get/Items`, {
                params: { includeReturned: true },
            }),
        ]);
        const baskets = basketResponse.data || [];
        const items = itemResponse.data || [];
        const userBaskets = baskets.filter(
            (basket) => String(basket.user_id) === String(user?.id)
        );
        const tempBasket = userBaskets.find((basket) => basket.is_temp);
        const basketMap = new Map(
            userBaskets.map((basket) => [String(basket.basket_id), basket])
        );
        const activeItems = items.filter((item) => !item.isReturned);
        const userItems = activeItems.filter(
            (item) => String(item.userId) === String(user?.id)
        );
        const returnedItems = items.filter(
            (item) =>
                item.isReturned
                && !item.isTenderReannounced
                && String(item.userId) === String(user?.id)
        );
        const tempItems = tempBasket
            ? userItems.filter(
                (item) => String(item.basketId) === String(tempBasket.basket_id)
            )
            : [];
        const finalItems = userItems.filter((item) => {
            const basket = basketMap.get(String(item.basketId));
            return basket && !basket.is_temp;
        });

        tempBasketId.current = tempBasket?.basket_id || null;
        setYourOrders(
            tempItems.map((item) => ({
                ...item,
                key: `temp-${item.basketItemId}`,
                year: getOrderYear(item),
                month: getOrderMonth(item),
            }))
        );
        setPackagedOrders(
            finalItems.map((item) => {
                const basket = basketMap.get(String(item.basketId));
                return {
                    ...item,
                    key: `packaged-${item.basketItemId}`,
                    year: getOrderYear(item),
                    month: getOrderMonth(item),
                    destinationBasketName:
                        String(basket?.basket_type || "").trim().toUpperCase() === PLAN_INBOX_TYPE
                            ? `Төлөвлөгөө: ${basket?.plan_name || "Нэргүй"}`
                            : basket?.basket_name || "",
                };
            })
        );
        setReturnedOrders(
            returnedItems.map((item) => ({
                ...item,
                key: `returned-${item.basketItemId}`,
                year: getOrderYear(item),
                month: getOrderMonth(item),
            }))
        );
        return { userItems, allItems: activeItems };
    }, [API_BASE_URL, user?.id]);
    loadBasketStateRef.current = loadBasketState;

    const ensureTempBasket = useCallback(async () => {
        if (tempBasketId.current) return tempBasketId.current;

        const basketResponse = await axios.get(`${API_BASE_URL}/get/basket`);
        const existing = (basketResponse.data || []).find(
            (basket) =>
                String(basket.user_id) === String(user?.id) && basket.is_temp
        );
        if (existing) {
            tempBasketId.current = existing.basket_id;
            return existing.basket_id;
        }

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
        tempBasketId.current = response.data.basket_id;
        return response.data.basket_id;
    }, [API_BASE_URL, user?.id]);

    const handleMoveToMine = useCallback(async () => {
        if (!selectedRows.length) {
            message.warning("Ямар нэг мөр сонгоно уу!");
            return;
        }

        const rowsToMove = flattenRows(selectedRows);
        setLoading(true);
        try {
            const basketId = await ensureTempBasket();
            const results = await Promise.allSettled(
                rowsToMove.map((item) =>
                    axios.post(
                        `${API_BASE_URL}/post/PostBasketItems`,
                        createBasketItemPayload(item, basketId)
                    )
                )
            );
            const insertedRows = rowsToMove.filter(
                (_, index) => results[index].status === "fulfilled"
            );
            const insertFailures = results
                .filter((result) => result.status === "rejected")
                .map((result) => ({
                    status: result.reason?.response?.status,
                    data: result.reason?.response?.data,
                    message: result.reason?.message,
                }));
            if (insertFailures.length) {
                console.error("PostBasketItems failures:", insertFailures);
            }
            const identities = new Set(insertedRows.map(getOrderIdentity));

            setAllData((previous) =>
                previous.filter((item) => !identities.has(getOrderIdentity(item)))
            );
            ordersByYear.current.set(
                activeYear,
                (ordersByYear.current.get(activeYear) || []).filter(
                    (item) => !identities.has(getOrderIdentity(item))
                )
            );
            await loadBasketState();
            resetSelection();
            setActiveSection("mine");
            setMineOrderStatus("unpackaged");

            const failedCount = rowsToMove.length - insertedRows.length;
            if (failedCount) {
                const firstError = insertFailures[0]?.data?.details || insertFailures[0]?.data?.error || insertFailures[0]?.message || "";
                message.warning(`${insertedRows.length} захиалга хадгалагдаж, ${failedCount} амжилтгүй боллоо. ${firstError}`);
            } else {
                message.success(`${insertedRows.length} захиалгыг Миний сагсанд хадгаллаа`);
            }
        } catch (err) {
            console.error("Temporary basket insert failed:", err);
            message.error("Миний сагсанд хадгалахад алдаа гарлаа");
        } finally {
            setLoading(false);
        }
    }, [API_BASE_URL, activeYear, ensureTempBasket, loadBasketState, resetSelection, selectedRows]);

    const submitReturn = useCallback(async (comment, cancel) => {
        const rowsToReturn = flattenRows(selectedRows);
        const packageMap = new Map(
            rowsToReturn
                .filter((item) => item.pkgno && item.pkgdate)
                .map((item) => [`${item.pkgno}_${item.pkgdate}`, {
                    pkgno: item.pkgno,
                    pkgdate: item.pkgdate,
                }])
        );

        if (!packageMap.size) {
            message.warning("Буцаах боломжтой багцын мэдээлэл олдсонгүй");
            return false;
        }

        setLoading(true);
        try {
            const validToken = await fetchToken();
            if (!validToken) throw new Error("Token not received");

            const packageResults = await Promise.allSettled(
                [...packageMap.entries()].map(async ([packageKey, pkg]) => {
                    const response = await returnOrder(
                        pkg.pkgno,
                        pkg.pkgdate,
                        user?.code,
                        comment,
                        cancel,
                        validToken
                    );
                    if (response.data?.status === false) {
                        throw new Error(response.data?.message || "Return failed");
                    }
                    return packageKey;
                })
            );
            const returnedPackageKeys = new Set(
                packageResults
                    .filter((result) => result.status === "fulfilled")
                    .map((result) => result.value)
            );
            const failedPackageReasons = packageResults
                .filter((result) => result.status === "rejected")
                .map((result) =>
                    result.reason?.response?.data?.message ||
                    result.reason?.response?.data?.error ||
                    result.reason?.message ||
                    "Тодорхойгүй алдаа"
                );
            if (failedPackageReasons.length) {
                console.error("Orders back API failures:", failedPackageReasons);
            }
            const returnedRows = rowsToReturn.filter((item) =>
                returnedPackageKeys.has(`${item.pkgno}_${item.pkgdate}`)
            );
            let taggedCount = 0;
            if (returnedRows.length) {
                const tagResponse = await axios.put(`${API_BASE_URL}/put/ReturnBasketItems`, {
                    basket_item_ids: returnedRows.map((item) => item.basketItemId),
                    user_id: user.id,
                    tailbar: comment,
                    cancel,
                });
                taggedCount = Number(tagResponse.data?.returned_count || 0);
            }
            await loadBasketState();
            resetSelection();
            setActiveSection("mine");
            setMineOrderStatus("unpackaged");

            const failedPackages = packageMap.size - returnedPackageKeys.size;
            const failedTags = returnedRows.length - taggedCount;
            if (failedPackages || failedTags) {
                message.warning(
                    `${returnedPackageKeys.size} багц буцсан, ${failedPackages} багц амжилтгүй, ${failedTags} захиалга тэмдэглэгдсэнгүй. ${failedPackageReasons[0] || ""}`
                );
            } else {
                message.success(`${returnedPackageKeys.size} багц амжилттай буцаагдлаа`);
            }
            return returnedPackageKeys.size > 0;
        } catch (err) {
            console.error("Order return failed:", err);
            message.error("Захиалгыг буцаахад алдаа гарлаа");
            return false;
        } finally {
            setLoading(false);
        }
    }, [API_BASE_URL, fetchToken, loadBasketState, resetSelection, selectedRows, user?.code, user?.id]);

    const handleReturnToAll = useCallback(() => {
        if (!selectedRows.length) return;

        const returnableRows = flattenRows(selectedRows).filter(
            (item) => item.pkgno && item.pkgdate
        );
        if (!returnableRows.length) {
            message.warning("Сонгосон захиалгад багцын дугаар эсвэл огноо байхгүй байна");
            return;
        }

        let returnValues = {
            selectedReasons: [],
            additionalComment: "",
            cancel: false,
        };
        Modal.confirm({
            title: "Захиалга буцаах",
            width: 760,
            className: "return-order-modal",
            content: <ReturnOrderForm onValuesChange={(values) => { returnValues = values; }} />,
            okText: "Буцаах хүсэлт илгээх",
            cancelText: "Болих",
            okButtonProps: { danger: true },
            onOk: (close) => {
                const comment = [
                    ...returnValues.selectedReasons,
                    returnValues.additionalComment.trim(),
                ]
                    .filter(Boolean)
                    .join("; ");
                if (!comment.trim()) {
                    message.warning("Буцаах шалтгаан сонгоно уу");
                    return;
                }
                if (comment.length > 1000) {
                    message.warning("Буцаах тайлбар нийт 1000 тэмдэгтээс хэтрэхгүй байна");
                    return;
                }
                submitReturn(comment.trim(), returnValues.cancel).then((succeeded) => {
                    if (succeeded) close();
                });
            },
        });
    }, [selectedRows.length, submitReturn]);

    const handleReleaseToAll = useCallback(async () => {
        if (!selectedRows.length) return;

        const rowsToRelease = flattenRows(selectedRows);
        setLoading(true);
        try {
            const results = await Promise.allSettled(
                rowsToRelease.map((item) =>
                    axios.delete(`${API_BASE_URL}/delete/basket-item`, {
                        params: { id: item.basketItemId },
                    })
                )
            );
            const deletedCount = results.filter(
                (result) => result.status === "fulfilled"
            ).length;

            ordersByYear.current.delete(activeYear);
            setAllData([]);
            await loadBasketState();
            await fetchData(activeYear);
            resetSelection();
            setActiveSection("all");

            if (deletedCount !== rowsToRelease.length) {
                message.warning(
                    `${deletedCount} захиалга чөлөөлөгдөж, ${rowsToRelease.length - deletedCount} амжилтгүй боллоо`
                );
            } else {
                message.success(`${deletedCount} захиалгыг Нэгдсэн сагс руу буцаалаа`);
            }
        } catch (err) {
            console.error("Release temporary orders failed:", err);
            message.error("Захиалгыг чөлөөлөхөд алдаа гарлаа");
        } finally {
            setLoading(false);
        }
    }, [API_BASE_URL, activeYear, fetchData, loadBasketState, resetSelection, selectedRows]);

    const handleUnpackOrders = useCallback(() => {
        if (!selectedRows.length) return;

        const rowsToUnpack = flattenRows(selectedRows);
        Modal.confirm({
            title: "Багцаас хасах уу?",
            content: `${rowsToUnpack.length} захиалгыг Багцлаагүй хэсэг рүү шилжүүлнэ.`,
            okText: "Багцаас хасах",
            cancelText: "Болих",
            centered: true,
            onOk: async () => {
                setLoading(true);
                try {
                    const basketId = await ensureTempBasket();
                    const response = await axios.put(`${API_BASE_URL}/put/UnpackBasketItems`, {
                        basket_item_ids: rowsToUnpack.map((item) => item.basketItemId),
                        target_basket_id: basketId,
                        user_id: user.id,
                    });
                    const movedCount = Number(response.data?.moved_count || 0);
                    if (movedCount !== rowsToUnpack.length) {
                        throw new Error("Selected orders were not removed completely");
                    }

                    await loadBasketState();
                    resetSelection();
                    setMineOrderStatus("unpackaged");
                    message.success(`${movedCount} захиалгыг багцаас хаслаа`);
                } catch (error) {
                    console.error("Unpack basket items failed:", error);
                    const backendMessage =
                        error.response?.data?.error ||
                        error.response?.data?.message ||
                        (typeof error.response?.data === "string" ? error.response.data : "") ||
                        error.message;
                    message.error(backendMessage || "Багцаас хасахад алдаа гарлаа");
                    throw error;
                } finally {
                    setLoading(false);
                }
            },
        });
    }, [API_BASE_URL, ensureTempBasket, loadBasketState, resetSelection, selectedRows, user.id]);

    const handleAfterInsert = useCallback(async () => {
        try {
            await loadBasketState();
            setActiveSection("mine");
        } catch (err) {
            console.error("Basket count refresh failed:", err);
            message.error("Сагсны тоог шинэчлэхэд алдаа гарлаа");
        }
    }, [loadBasketState]);

    // ✅ Remove inserted rows (optimized)
    const handleRemoveInsertedRows = useCallback((rowsToRemove = []) => {
        const flattenedRows = flattenRows(rowsToRemove);
        const idsToRemove = new Set(
            flattenedRows.map((row) => row.key).filter(Boolean)
        );
        const identitiesToRemove = new Set(flattenedRows.map(getOrderIdentity));

        setYourOrders((prev) =>
            prev.filter(
                (item) =>
                    !idsToRemove.has(item.key) &&
                    !identitiesToRemove.has(getOrderIdentity(item))
            )
        );
        resetSelection();
    }, [resetSelection]);

    const filteredAllData = useMemo(
        () =>
            activeMonths.length
                ? allData.filter((item) => activeMonths.includes(item.month))
                : allData,
        [activeMonths, allData]
    );
    const visibleAllData = useMemo(() => {
        if (ownershipFilter === "claimed") {
            return filteredAllData.filter((item) => item.isLocked);
        }
        if (ownershipFilter === "unclaimed") {
            return filteredAllData.filter((item) => !item.isLocked);
        }
        return filteredAllData;
    }, [filteredAllData, ownershipFilter]);
    const ownershipStats = useMemo(() => {
        const unclaimed = filteredAllData.filter((item) => !item.isLocked);
        const claimed = filteredAllData.filter((item) => item.isLocked);
        const getPackageCount = (items) =>
            new Set(items.filter((item) => item.pkgno).map(getPackageIdentity)).size;

        return {
            all: { orders: filteredAllData.length, packages: getPackageCount(filteredAllData) },
            unclaimed: { orders: unclaimed.length, packages: getPackageCount(unclaimed) },
            claimed: { orders: claimed.length, packages: getPackageCount(claimed) },
        };
    }, [filteredAllData]);
    const allPackageCount = useMemo(
        () => new Set(visibleAllData.filter((item) => item.pkgno).map(getPackageIdentity)).size,
        [visibleAllData]
    );
    const unpackagedPackageCount = useMemo(
        () => new Set(yourOrders.filter((item) => item.pkgno).map(getPackageIdentity)).size,
        [yourOrders]
    );
    const packagedPackageCount = useMemo(
        () => new Set(packagedOrders.filter((item) => item.pkgno).map(getPackageIdentity)).size,
        [packagedOrders]
    );
    const returnedPackageCount = useMemo(
        () => new Set(returnedOrders.filter((item) => item.pkgno).map(getPackageIdentity)).size,
        [returnedOrders]
    );
    const mineOrders = mineOrderStatus === "packaged"
        ? packagedOrders
        : mineOrderStatus === "returned"
            ? returnedOrders
            : yourOrders;
    const myPackageCount = unpackagedPackageCount + packagedPackageCount + returnedPackageCount;

    if (!user) {
        return <div style={{ padding: 20 }}>Хэрэглэгч нэвтрээгүй байна.</div>;
    }

    return (
        <div className="packing-office">
            <header className="packing-titlebar">
                <div className="packing-titlebar__identity">
                    <span className="packing-titlebar__icon"><AppstoreAddOutlined /></span>
                    <div>
                        <h1>Сагс ба багцлалт</h1>
                        <p>Захиалга сонгох, сагсанд авах, төлөвлөгөөнд шилжүүлэх нэгдсэн ажлын талбар</p>
                    </div>
                </div>
                <div className="packing-titlebar__summary">
                    <span className="packing-summary-chip">Он: <strong>{activeYear}</strong></span>
                    <span className="packing-summary-chip">
                        Сар: <strong>{activeMonths.length ? [...activeMonths].sort((a, b) => a - b).join(", ") : "Бүгд"}</strong>
                    </span>
                    <span className="packing-summary-chip">Сонгосон: <strong>{selectedRows.length}</strong></span>
                </div>
            </header>

            <section className="packing-ribbon">
                <div className="packing-ribbon__group">
                    <div className="packing-period-controls">
                        <div className="packing-period-block">
                            <span className="packing-period-block__label">Он</span>
                            {years.map((year) => (
                                <Button
                                    key={year}
                                    className={`packing-period-button ${activeYear === year ? "is-active" : ""}`}
                                    onClick={() => {
                                        setActiveYear(year);
                                        setActiveMonths([]);
                                        setAllData([]);
                                        setSelectedRows([]);
                                        setSelectionResetToken((token) => token + 1);
                                        fetchData(year);
                                    }}
                                >
                                    {year}
                                </Button>
                            ))}
                        </div>
                        <div className="packing-period-block">
                            <span className="packing-period-block__label">Сар</span>
                            <Button
                                className={`packing-period-button ${activeMonths.length === 0 ? "is-active" : ""}`}
                                disabled={loading}
                                onClick={() => {
                                    setActiveMonths([]);
                                    resetSelection();
                                }}
                            >
                                Бүгд
                            </Button>
                            {months.map((month) => {
                                const isActive = activeMonths.includes(month);
                                return (
                                    <Button
                                        key={month}
                                        className={`packing-period-button ${isActive ? "is-active" : ""}`}
                                        disabled={loading}
                                        onClick={() => {
                                            if (isActive) {
                                                setActiveMonths((current) => current.filter((item) => item !== month));
                                                resetSelection();
                                            } else {
                                                setActiveMonths((current) => [...current, month]);
                                            }
                                        }}
                                    >
                                        {month}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="packing-ribbon__group">
                    <div className="packing-ribbon__actions">
                        {activeSection === "all" ? (
                            <Button
                                className="packing-action packing-move-button"
                                disabled={loading || !selectedRows.length}
                                onClick={handleMoveToMine}
                                icon={<ShoppingCartOutlined />}
                                loading={loading}
                            >
                                <span>Миний сагсанд оруулах</span>
                                <span className="packing-move-button__count">{selectedRows.length}</span>
                            </Button>
                        ) : mineOrderStatus === "unpackaged" ? (
                            <>
                                <Button
                                    className="packing-action"
                                    disabled={loading || !selectedRows.length}
                                    onClick={handleReleaseToAll}
                                    icon={<RollbackOutlined />}
                                >
                                    Нэгдсэн сагс руу буцаах
                                </Button>
                                <Button
                                    className="packing-action"
                                    disabled={loading || !selectedRows.length}
                                    onClick={handleReturnToAll}
                                    danger
                                    icon={<DisconnectOutlined />}
                                >
                                    Буцаах
                                </Button>
                                <Button
                                    className="packing-action packing-action--primary"
                                    disabled={loading || !selectedRows.length}
                                    onClick={() => setVisible(true)}
                                    type="primary"
                                    icon={<ProjectOutlined />}
                                >
                                    Төлөвлөгөөнд оруулах ({selectedRows.length})
                                </Button>
                            </>
                        ) : mineOrderStatus === "packaged" ? (
                            <Button
                                className="packing-action"
                                disabled={loading || !selectedRows.length}
                                onClick={handleUnpackOrders}
                                danger
                                icon={<DisconnectOutlined />}
                            >
                                Багцаас хасах ({selectedRows.length})
                            </Button>
                        ) : null}
                    </div>
                </div>
            </section>

            <main className="packing-workspace">
                <Tabs
                    className="packing-workspace-tabs"
                    activeKey={activeSection}
                    onChange={(section) => {
                        setActiveSection(section);
                        resetSelection();
                    }}
                    items={[
                        {
                            key: "all",
                            label: (
                                <span className="packing-tab-label">
                                    <InboxOutlined />
                                    <strong>Нэгдсэн сагс</strong>
                                    <small>{allPackageCount.toLocaleString()} багц · {visibleAllData.length.toLocaleString()} захиалга</small>
                                </span>
                            ),
                            children: loading ? (
                                <div className="packing-loading">
                                    <Spin tip="Уншиж байна..."><div style={{ height: 60 }} /></Spin>
                                </div>
                            ) : (
                                <>
                                    <div className="packing-filterbar packing-filterbar--left">
                                        {[
                                            { key: "all", label: "Бүгд", icon: <UnorderedListOutlined /> },
                                            { key: "unclaimed", label: "Аваагүй", icon: <UnlockOutlined /> },
                                            { key: "claimed", label: "Авсан", icon: <LockOutlined /> },
                                        ].map((option) => (
                                            <button
                                                key={option.key}
                                                type="button"
                                                aria-pressed={ownershipFilter === option.key}
                                                className={`packing-ownership-card packing-ownership-card--${option.key} ${ownershipFilter === option.key ? "is-active" : ""}`}
                                                onClick={() => {
                                                    setOwnershipFilter(option.key);
                                                    resetSelection();
                                                }}
                                            >
                                                <span className="packing-ownership-card__icon">{option.icon}</span>
                                                <span className="packing-ownership-card__content">
                                                    <strong>{option.label}</strong>
                                                    <small>
                                                        {ownershipStats[option.key].packages.toLocaleString()} багц · {ownershipStats[option.key].orders.toLocaleString()} захиалга
                                                    </small>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <Table
                                        data={visibleAllData}
                                        onSelectRows={setSelectedRows}
                                        selectionResetToken={selectionResetToken}
                                    />
                                </>
                            ),
                        },
                        {
                            key: "mine",
                            label: (
                                <span className="packing-tab-label">
                                    <UserOutlined />
                                    <strong>Миний сагс</strong>
                                    <small>{myPackageCount.toLocaleString()} багц · {(yourOrders.length + packagedOrders.length + returnedOrders.length).toLocaleString()} захиалга</small>
                                </span>
                            ),
                            children: (
                                <>
                                    <div className="packing-filterbar packing-filterbar--left">
                                        {[
                                            {
                                                key: "unpackaged",
                                                label: "Багцлаагүй",
                                                icon: <ShoppingCartOutlined />,
                                                packages: unpackagedPackageCount,
                                                orders: yourOrders.length,
                                            },
                                            {
                                                key: "packaged",
                                                label: "Багцалсан",
                                                icon: <AppstoreAddOutlined />,
                                                packages: packagedPackageCount,
                                                orders: packagedOrders.length,
                                            },
                                            {
                                                key: "returned",
                                                label: "Буцаасан",
                                                icon: <RollbackOutlined />,
                                                packages: returnedPackageCount,
                                                orders: returnedOrders.length,
                                            },
                                        ].map((option) => (
                                            <button
                                                key={option.key}
                                                type="button"
                                                aria-pressed={mineOrderStatus === option.key}
                                                className={`packing-ownership-card packing-ownership-card--${option.key} ${mineOrderStatus === option.key ? "is-active" : ""}`}
                                                onClick={() => {
                                                    setMineOrderStatus(option.key);
                                                    resetSelection();
                                                }}
                                            >
                                                <span className="packing-ownership-card__icon">{option.icon}</span>
                                                <span className="packing-ownership-card__content">
                                                    <strong>{option.label}</strong>
                                                    <small>{option.packages.toLocaleString()} багц · {option.orders.toLocaleString()} захиалга</small>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <Table
                                        data={mineOrders}
                                        onSelectRows={setSelectedRows}
                                        selectionResetToken={selectionResetToken}
                                        showOwner={false}
                                        selectable={mineOrderStatus !== "returned"}
                                        showReturnComment={mineOrderStatus === "returned"}
                                    />
                                </>
                            ),
                        },
                    ]}
                />
                <footer className="packing-statusbar">
                    <span>{activeSection === "all" ? "Нэгдсэн сагс" : "Миний сагс"} · {activeYear} он</span>
                    <span>Сонгосон: <strong>{selectedRows.length}</strong></span>
                </footer>
            </main>

            <PlanAssignmentModal
                visible={visible}
                setVisible={setVisible}
                selectedRows={selectedRows}
                removeInsertedRows={handleRemoveInsertedRows}
                onInserted={handleAfterInsert}
            />
        </div>
    );
};

export default Багцлах;
