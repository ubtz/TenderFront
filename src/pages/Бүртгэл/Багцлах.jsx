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
            if (fetchedMonths.current.has(`${yy}-${mm}`)) return; // avoid duplicate month fetch
            fetchedMonths.current.add(`${yy}-${mm}`);

            setLoading(true);
            let validToken = token || (await fetchToken());
            if (!validToken) {
                setLoading(false);
                return;
            }

            try {
                // 🔹 Local API (basket data)
                const basketRes = await axios.get(`${API_BASE_URL}/get/Items`);
                const basketItems = basketRes.data || [];
                const userId = user.id;
                const filteredItems = basketItems.filter((item) => item.userId === userId);

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

                // 🔹 External API (order data)
                const ordersRes = await axios.post("http://192.168.4.107:8008/v1/orders/list", {
                    Yy: yy,
                    Mm: mm,
                    Man: man,
                    Token: validToken,
                });
                console.log("Orders response:", ordersRes.data);
                let orders = ordersRes.data.records || [];
                orders = orders.filter((order) => {
                    const key = `${String(order.code).trim()}-${String(order.dname).trim()}-${String(
                        order.dcode
                    ).trim()}-${Number(order.price)}-${Number(order.qty)}-${String(order.mdocno).trim()}`;
                    return !basketKeys.has(key);
                });

                const recordsWithKey = orders.map((rec, idx) => ({
                    ...rec,
                    key: `${rec.code || "x"}-${rec.dname || "x"}-${rec.dcode || "x"}-${rec.price || 0
                        }-${rec.qty || 0}-${rec.mdocno || "x"}-${idx}`,
                    year: yy,
                    month: parseInt(mm, 10),
                }));

                setAllData((prev) => {
                    const merged = [...prev, ...recordsWithKey];
                    const unique = Array.from(new Map(merged.map((item) => [item.key, item])).values());
                    return unique;
                });
                console.log("allData:", allData);
                const uniquePkgSet = new Set(filteredItems.map((item) => `${item.pkgno}-${item.pkgdate}`));
                setUniqueCount(uniquePkgSet.size);
            } catch (err) {
                message.error("Өгөгдөл авахад алдаа гарлаа.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        },
        [API_BASE_URL, token, fetchToken, user, activeYear]
    );

    useEffect(() => {
        fetchData(activeYear, new Date().getMonth() + 1);
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
                    Та нийт <b>{selectedRows.length}</b> мөр буцаах гэж байна.
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
                    <Button size="small" disabled={loading} onClick={handleRollback}>
                        Буцаах
                    </Button>
                    <Button size="small" disabled={loading} onClick={() => setVisible(true)}>
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
