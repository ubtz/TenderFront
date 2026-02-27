import React, { useEffect, useState, useRef, useCallback } from "react";
import { Button, Space, Card, Row, Col, message, Spin, Modal, Input } from "antd";
import Table from "./Table";
import dayjs from "dayjs";
import axios from "axios";
import MyModalWithTable from "./Modal_Багцлах";

const { TextArea } = Input;

const Багцлах = () => {
    const userJson = localStorage.getItem("data");
    const user = userJson ? JSON.parse(userJson) : null;

    const [visible, setVisible] = useState(false);
    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [selectedRows, setSelectedRows] = useState([]);
    const [allData, setAllData] = useState([]);
    const [activeYear, setActiveYear] = useState("2025");
    const [activeMonths, setActiveMonths] = useState([]);
    const [uniqueCount, setUniqueCount] = useState(0);

    const API_BASE_URL = import.meta.env.VITE_API_URL;
    const years = ["2024", "2025", "2026"];
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const fetchedMonths = useRef(new Set()); // ✅ prevents duplicate fetches

    // ✅ Fetch token and cache it in localStorage
    const fetchToken = useCallback(async () => {
        try {
            const res = await axios.post("http://192.168.4.107:8008/v1/token/gtoken", {
                Username: "coss.api.lib.nrp",
                Password: "coss.api.lib.nrp.",
            });
            const token = res.data?.tokendata; // adjust after you check Step A
            setToken(token);
            return token;
        } catch (err) {
            message.error("Токен авахад алдаа гарлаа");
            console.error("Token fetch error:", err);
            return null;
        }
    }, []);


    // ✅ Fetch and merge data efficiently
    const fetchData = useCallback(
        async (yy = activeYear, mm, man = String(user?.code || "")) => {

            const monthKey = `${yy}-${mm}`;

            // ⛔ already fetched successfully → skip
            if (fetchedMonths.current.has(monthKey)) return;

            setLoading(true);

            let validToken = token;

            try {
                // 1️⃣ ensure token
                if (!validToken) {
                    validToken = await fetchToken();
                    if (!validToken) throw new Error("Token not received");
                }

                // 2️⃣ get basket (local API)
                const basketRes = await axios.get(`${API_BASE_URL}/get/Items`);
                const basketItems = basketRes.data || [];
                const userId = user.id;

                const filteredItems = basketItems.filter(
                    (item) => item.userId === userId
                );

                const basketKeys = new Set(
                    filteredItems.map(
                        (item) =>
                            `${String(item.code).trim()}-${String(item.dname).trim()}-${String(
                                item.dcode
                            ).trim()}-${Number(item.price)}-${Number(item.qty)}-${String(
                                item.mdocno
                            ).trim()}`
                    )
                );

                // 3️⃣ call orders API
                let ordersRes = await axios.post(
                    "http://192.168.4.107:8008/v1/orders/list",
                    {
                        Yy: yy,
                        Mm: mm,
                        Man: man,
                        Token: validToken,
                    }
                );

                // 🔁 token invalid → retry once
                if (ordersRes.data?.message === "Token incorrect!") {
                    validToken = await fetchToken();
                    if (!validToken) throw new Error("Token refresh failed");

                    ordersRes = await axios.post(
                        "http://192.168.4.107:8008/v1/orders/list",
                        {
                            Yy: yy,
                            Mm: mm,
                            Man: man,
                            Token: validToken,
                        }
                    );
                }

                if (!ordersRes.data?.status) {
                    throw new Error(ordersRes.data?.message || "Orders API error");
                }

                // ✅ mark month as successfully fetched
                fetchedMonths.current.add(monthKey);

                // 4️⃣ filter out basket items
                let orders = ordersRes.data.records || [];
                console.log("Fetched orders:", ordersRes);
                orders = orders.filter((order) => {
                    const key = `${String(order.code).trim()}-${String(order.dname).trim()}-${String(
                        order.dcode
                    ).trim()}-${Number(order.price)}-${Number(order.qty)}-${String(
                        order.mdocno
                    ).trim()}`;
                    return !basketKeys.has(key);
                });

                // 5️⃣ normalize records
                const recordsWithKey = orders.map((rec, idx) => ({
                    ...rec,
                    key: `${rec.code || "x"}-${rec.dname || "x"}-${rec.dcode || "x"}-${rec.price || 0
                        }-${rec.qty || 0}-${rec.mdocno || "x"}-${idx}`,
                    year: yy,
                    month: Number(mm),
                }));

                // 6️⃣ merge without duplicates
                setAllData((prev) => {
                    const merged = [...prev, ...recordsWithKey];
                    return Array.from(
                        new Map(merged.map((item) => [item.key, item])).values()
                    );
                });

                // 7️⃣ update basket count
                const uniquePkgSet = new Set(
                    filteredItems.map((item) => `${item.pkgno}-${item.pkgdate}`)
                );
                setUniqueCount(uniquePkgSet.size);

            } catch (err) {
                // console.error("fetchData error:", err);
                // message.error("Захиалгын мэдээлэл татахад алдаа гарлаа");
            } finally {
                setLoading(false);
            }
        },
        [API_BASE_URL, token, fetchToken, user, activeYear]
    );

    useEffect(() => {
        (async () => {
            const t = await fetchToken();
            if (t) {
                fetchData(activeYear, new Date().getMonth() + 1);
            }
        })();
    }, []);


    // ✅ Rollback handler — single modal for all selected rows
    const handleRollback = useCallback(() => {
        if (!selectedRows.length) {
            message.warning("Ямар нэг мөр сонгоно уу!");
            return;
        }

        let comment = "";
        Modal.confirm({
            title: "Буцаах баталгаажуулалт",
            content: (
                <div>
                    Та нийт <b>{selectedRows.length}</b> Багц буцаах гэж байна.
                    <br />
                    <TextArea
                        rows={3}
                        style={{ marginTop: 8 }}
                        placeholder="Тайлбар..."
                        onChange={(e) => (comment = e.target.value)}
                    />
                </div>
            ),
            okText: "Тийм",
            cancelText: "Үгүй",
            onOk: () => {
                console.log("Rollback:", selectedRows, "Reason:", comment);
                // TODO: call rollback API
                message.success("Буцаах хүсэлт илгээгдлээ");
            },
        });
    }, [selectedRows]);
    const handleAfterInsert = useCallback(() => {
        // Recalculate basket count after insertion
        axios.get(`${API_BASE_URL}/get/Items`).then((res) => {
            const items = res.data || [];
            const userItems = items.filter((i) => i.userId === user.id);
            const unique = new Set(userItems.map((i) => `${i.pkgno}-${i.pkgdate}`));
            setUniqueCount(unique.size);
        });
    }, [API_BASE_URL, user]);
    // ✅ Remove inserted rows (optimized)
    const handleRemoveInsertedRows = useCallback((rowsToRemove = []) => {
        const idsToRemove = new Set(
            rowsToRemove.flatMap((r) => (r.items ? r.items.map((i) => i.key) : [r.key]))
        );
        setAllData((prev) => prev.filter((item) => !idsToRemove.has(item.key)));
        setSelectedRows([]);
        message.success(`🗑️ ${idsToRemove.size} мөр устгалаа`);
    }, []);

    if (!user) {
        return <div style={{ padding: 20 }}>Хэрэглэгч нэвтрээгүй байна.</div>;
    }

    return (
        <div style={{ padding: 20 }}>
            {/* Header controls */}
            <div
                style={{
                    marginBottom: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                {/* 🔹 Year Selector */}
                <Space>
                    <span style={{ fontWeight: "bold", marginRight: 8 }}>Жил:</span>
                    {years.map((yy) => (
                        <Button
                            key={yy}
                            size="small"
                            type={activeYear === yy ? "primary" : "default"}
                            onClick={() => {
                                setActiveYear(yy);
                                setActiveMonths([]);
                                setAllData([]);
                                fetchedMonths.current.clear();
                            }}
                        >
                            {yy}
                        </Button>
                    ))}
                </Space>

                {/* 🔹 Month Selector */}
                <Space wrap align="center">
                    <span style={{ fontWeight: "bold", marginRight: 8 }}>Сар:</span>
                    {months.map((mm) => {
                        const isActive = activeMonths.includes(mm);
                        return (
                            <Button
                                key={mm}
                                size="small"
                                type={isActive ? "primary" : "default"}
                                disabled={loading}
                                onClick={() => {
                                    if (isActive) {
                                        setActiveMonths((prev) => prev.filter((m) => m !== mm));
                                        setAllData((prev) => prev.filter((item) => item.month !== mm));
                                        // allow re-fetch later if user clicks the month again
                                        fetchedMonths.current.delete(`${activeYear}-${mm}`);
                                    } else {
                                        setActiveMonths((prev) => [...prev, mm]);
                                        fetchData(activeYear, String(mm));
                                    }

                                }}
                            >
                                {mm}
                            </Button>
                        );
                    })}
                </Space>

                {/* 🔹 Actions */}
                <Space>
                    <Button size="small" disabled={loading} onClick={handleRollback} danger>
                        Буцаах
                    </Button>
                    <Button size="small" disabled={loading} onClick={() => setVisible(true)} type="primary">
                        Багцлах
                    </Button>
                    <MyModalWithTable
                        visible={visible}
                        setVisible={setVisible}
                        selectedRows={selectedRows}
                        removeInsertedRows={handleRemoveInsertedRows}
                        onInserted={handleAfterInsert}   // ✅ add this
                    />

                </Space>
            </div>

            {/* 🔹 Info cards */}
            <Row gutter={8} style={{ marginBottom: 10 }}>
                <Col span={6}>
                    <Card size="small" style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 12, color: "#666" }}>Нийт хүсэлт</div>
                        <div style={{ fontSize: 16, fontWeight: "bold" }}>
                            {new Set(allData.map((item) => item.pkgno).filter(Boolean)).size}
                        </div>
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small" style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 12, color: "#666" }}>Хүсэлт</div>
                        <div style={{ fontSize: 16, fontWeight: "bold" }}>?</div>
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small" style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 12, color: "#666" }}>Сагслагдсан</div>
                        <div style={{ fontSize: 16, fontWeight: "bold" }}>{uniqueCount}</div>
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small" style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 12, color: "#666" }}>Буцаагдсан</div>
                        <div style={{ fontSize: 16, fontWeight: "bold" }}>?</div>
                    </Card>
                </Col>
            </Row>

            {/* 🔹 Data table */}
            <Card size="small" styles={{ body: { padding: 0 } }}>
                {loading ? (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                        <Spin tip="Уншиж байна...">
                            <div style={{ height: 60 }} /> {/* 👈 gives Spin something to "wrap" */}
                        </Spin>
                    </div>
                ) : (
                    <Table
                        data={allData}
                        rowKey="key"
                        onSelectRows={setSelectedRows}
                        hideActions={user?.erh === "Удирдлага"}
                    />
                )}
            </Card>

        </div>
    );
};

export default Багцлах;
