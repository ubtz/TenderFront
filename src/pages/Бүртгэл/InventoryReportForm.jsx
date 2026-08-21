import "./InventoryReportForm.css";
import dayjs from "dayjs";
import React, { useState, useEffect, useMemo } from "react";
import { Button, Card, Typography, Divider, Table, message } from "antd";
import axios from "axios";

const { Title } = Typography;

export default function InventoryReportForm({ record = {}, onClose }) {
    const companyName =
        record.companyName ||
        record.company ||
        record.dname ||
        "“Улаанбаатар төмөр зам” хувь нийлүүлсэн нийгэмлэг";

    const currentYear = dayjs().year();
    const currentMonth = dayjs().month() + 1;
    const currentDate = dayjs().date();

    const [loading, setLoading] = useState(false);

    /**
     * materc2Map structure:
     * {
     *   [code]: {
     *     nha: number,
     *     byDname: {
     *        [dname]: { qty }
     *     }
     *   }
     * }
     */
    const [materc2Map, setMaterc2Map] = useState({});

    /* ---------- normalize item ---------- */
    const normalizeItem = (it = {}) => ({
        code: it.code ?? "",
        crmarkname: it.crmarkname ?? it.mname ?? it.name ?? "",
        cr4name: it.cr4name ?? "",
        usize: it.usize ?? it.mname ?? "",
        item_qty:
            it.qty !== undefined && it.qty !== "" ? Number(it.qty) : "",
        price:
            it.price !== undefined && it.price !== "" ? Number(it.price) : "",
        pricesum:
            it.pricesum !== undefined && it.pricesum !== ""
                ? Number(it.pricesum)
                : "",
        _rowKey:
            it.reactKey ??
            it.key ??
            `${it.code ?? "x"}-${it.dname ?? ""}-${it.pkgdate ?? ""}`,
        __raw: it,
    });

    const itemsBase = Array.isArray(record.items) ? record.items : [];

    /* ---------- fetch materc2 ---------- */
    useEffect(() => {
        let mounted = true;

        const API_BASE_URL = import.meta.env.VITE_API_URL;

        const pkgDateStr =
            record.Pkgdate ||
            record.pkgdate ||
            `${currentYear}/${String(currentMonth).padStart(2, "0")}/01`;

        const pkgNoStr = record.Pkgno || record.pkgno || "1";

        const fetchOrders = async () => {
            const body = {
                Pkgdate: pkgDateStr,
                Pkgno: pkgNoStr,
            };
            const res = await axios.post(`${API_BASE_URL}/external/orders/materc2`, body);
            return res.data;
        };

        const load = async () => {
            setLoading(true);
            try {
                const data = await fetchOrders();

                if (!mounted) return;

                const arr = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.rows)
                        ? data.rows
                        : [];

                const map = {};

                arr.forEach((it) => {
                    if (!it?.code || !it?.dname) return;

                    if (!map[it.code]) {
                        map[it.code] = {
                            nha:
                                it.qty_nha !== undefined && it.qty_nha !== ""
                                    ? Number(it.qty_nha)
                                    : "",
                            byDname: {},
                        };
                    }

                    map[it.code].byDname[it.dname] = {
                        qty:
                            it.qty !== undefined && it.qty !== ""
                                ? Number(it.qty)
                                : "",
                    };
                });

                setMaterc2Map(map);
            } catch (e) {
                console.error(e);
                message.error("materc2 мэдээлэл татахад алдаа гарлаа");
            } finally {
                if (mounted) setLoading(false);
            }
        };

        load();
        return () => {
            mounted = false;
        };
    }, [record.pkgdate, record.pkgno, record.Pkgdate, record.Pkgno]);

    /* ---------- collect all dname ---------- */
    const materc2Dnames = useMemo(() => {
        const set = new Set();
        Object.values(materc2Map).forEach((v) => {
            Object.keys(v?.byDname || {}).forEach((d) => set.add(d));
        });
        return Array.from(set);
    }, [materc2Map]);

    /* ---------- build rows (pivot) ---------- */
    const rows = itemsBase.map((r, i) => {
        const norm = normalizeItem(r);
        const m = materc2Map[norm.code] || { byDname: {}, nha: "" };

        const dynamicFields = {};
        materc2Dnames.forEach((dname) => {
            dynamicFields[`materc2_${dname}`] =
                m.byDname[dname]?.qty ?? "";
        });

        return {
            key: norm._rowKey || i,
            ...norm,
            ...dynamicFields,
            materc2_nha: m.nha, // 🔹 single НХА column
        };
    });

    /* ---------- columns ---------- */
    const baseColumns = [
        {
            title: "№",
            width: 60,
            align: "center",
            render: (_, __, i) => i + 1,
        },
        {
            title: "Бараа материалын код",
            dataIndex: "code",
            width: 160,
        },
        {
            title: "Бараа материалын нэр",
            dataIndex: "crmarkname",
            width: 260,
        },
        {
            title: "Захиалсан тоо",
            dataIndex: "item_qty",
            align: "right",
            width: 120,
            render: (v) =>
                v || v === 0 ? Number(v).toLocaleString() : "",
        },
    ];

    const materc2Columns = useMemo(
        () =>
            materc2Dnames.map((dname) => ({
                title: dname,
                dataIndex: `materc2_${dname}`,
                key: `materc2_${dname}`,
                align: "right",
                width: 140,
                render: (v) =>
                    v || v === 0 ? Number(v).toLocaleString() : "",
            })),
        [materc2Dnames]
    );

    const nhaColumn = {
        title: "НХ",
        dataIndex: "materc2_nha",
        key: "materc2_nha",
        align: "right",
        width: 140,
        render: (v) =>
            v || v === 0 ? Number(v).toLocaleString() : "",
    };

    const columns = [
        ...baseColumns,
        ...materc2Columns,
        nhaColumn,
        // {
        //     title: "Нийт үнэ",
        //     dataIndex: "pricesum",
        //     align: "right",
        //     width: 160,
        //     render: (v) =>
        //         v || v === 0 ? Number(v).toLocaleString() : "",
        // },
    ];

    /* ---------- render ---------- */
    return (
        <Card bordered style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>{companyName}</div>
                <div>
                    Хугацаа: {currentYear} оны {currentMonth} сарын{" "}
                    {currentDate}
                </div>
            </div>

            <Divider />

            <Title level={4} style={{ textAlign: "center" }}>
                “БАРАА МАТЕРИАЛЫН ҮЛДЭГДЭЛ”
            </Title>

            <Table
                bordered
                loading={loading}
                columns={columns}
                dataSource={rows}
                pagination={false}
                size="small"
                scroll={{ x: "max-content" }}
            />

            <Divider />

            <div style={{ textAlign: "right" }}>
                <Button onClick={onClose}>Хаах</Button>
            </div>
        </Card>
    );
}
