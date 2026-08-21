import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
    Table,
    Select,
    DatePicker,
    Row,
    Col,
    Spin,
    message,
    Input,
    Button,
    Modal,
    Space,
} from "antd";
import dayjs from "dayjs";
import "./mssql-table.css";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

const { Option } = Select;
const { RangePicker } = DatePicker;

const API_BASE_URL = import.meta.env.VITE_API_URL;
const calculateItemTotal = (record) => Number(record?.qty || 0) * Number(record?.price || 0);

pdfMake.vfs = pdfFonts.vfs;

const PROGRESS_NUMBER_FIELDS = [
    "TotalOrders",
    "TotalOrderValue",
    "TotalTenders",
    "TotalBudget",
    "SuccessfulTenders",
    "SuccessfulBudget",
    "SuspendedTenders",
    "TotalContracts",
    "TotalContractValue",
];

const TotalOrders = () => {
    const [data, setData] = useState([]);
    const [branches, setBranches] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("data") || "{}");
        } catch {
            return {};
        }
    }, []);
    const isUdirdlaga =
        user?.erh === "Удирдлага" || user?.Erh === "Удирдлага";

    const [manFilter, setManFilter] = useState(null);
    const [planFilter, setPlanFilter] = useState(null);
    const [dateRange, setDateRange] = useState([]);

    const [branchSearch, setBranchSearch] = useState("");
    const [itemSearch, setItemSearch] = useState("");
    const [markSearch, setMarkSearch] = useState("");
    const [codeSearch, setCodeSearch] = useState("");
    const [progressOpen, setProgressOpen] = useState(false);
    const [progressLoading, setProgressLoading] = useState(false);
    const [progressRows, setProgressRows] = useState([]);
    const [progressSummary, setProgressSummary] = useState(null);
    const [progressBranchStats, setProgressBranchStats] = useState([]);
    const PLAN_BASE_URL = "http://192.168.4.119:3114/static/upload/plan";
    const TECH_BASE_URL = "http://192.168.4.119:3114/static/upload/tech";

    const normalizeKey = (value) => String(value ?? "").trim();

    const decodeUploadPath = (value) => {
        let decoded = String(value ?? "").replace(/^\/+/, "");

        for (let i = 0; i < 3; i += 1) {
            try {
                const next = decodeURIComponent(decoded);
                if (next === decoded) break;
                decoded = next;
            } catch {
                break;
            }
        }

        return decoded;
    };

    const buildUploadUrl = (baseUrl, path) =>
        `${baseUrl}/${decodeUploadPath(path)}`;

    const getFullName = (user) =>
        `${user?.ovog || ""} ${user?.ner || ""}`.trim() ||
        user?.username ||
        user?.email ||
        "";

    // ================= FETCH =================
    const fetchData = async () => {
        try {
            setLoading(true);

            const [ordersRes, branchRes, usersRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/get/GetOrders`),
                axios.get(`${API_BASE_URL}/get/branches`),
                axios.get(`${API_BASE_URL}/get/GetUsers`),
            ]);

            setData(ordersRes.data.data || []);
            setBranches(branchRes.data || []);
            setUsers(usersRes.data || []);
            console.log(usersRes.data);
        } catch (err) {
            console.error(err);
            message.error("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchPurchaseProgress = async () => {
        try {
            setProgressLoading(true);
            setProgressOpen(true);

            const [statisticRes, branchStatsRes, branchesRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/get/Statistic`),
                axios.get(`${API_BASE_URL}/get/GetBranchStatistics`),
                branches.length ? Promise.resolve({ data: branches }) : axios.get(`${API_BASE_URL}/get/branches`),
            ]);
            const payload = statisticRes.data || {};

            setProgressRows(Array.isArray(payload.rows) ? payload.rows : []);
            setProgressSummary(payload.summary || null);
            setProgressBranchStats(Array.isArray(branchStatsRes.data) ? branchStatsRes.data : []);
            if (!branches.length) {
                setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
            }
        } catch (err) {
            console.error(err);
            message.error("Худалдан авалтын захиалгын явц татахад алдаа гарлаа");
        } finally {
            setProgressLoading(false);
        }
    };

    // ================= MAPS =================
    const branchMap = useMemo(() => {
        const map = {};
        branches.forEach((b) => {
            map[String(b.id)] = b.branch;
        });
        return map;
    }, [branches]);

    const userMap = useMemo(() => {
        const map = {};
        users.forEach((u) => {
            const name = getFullName(u);
            if (!name) return;

            [u.code, u.id, u.user_id, u.employee_id, u.empid].forEach((key) => {
                const normalizedKey = normalizeKey(key);
                if (normalizedKey) map[normalizedKey] = name;
            });
        });
        return map;
    }, [users]);

    const getUserName = (code) => userMap[normalizeKey(code)] || normalizeKey(code);

    // ================= FILTER =================
    const filteredData = useMemo(() => {
        return data.filter((item) => {
            let ok = true;

            const branchName = (branchMap[String(item.dcode)] || "").toLowerCase();
            const itemName = (item.cr4name || "").toLowerCase();
            const markName = (item.crmarkname || "").toLowerCase();
            const code = String(item.code || "").toLowerCase();

            // 🔎 Branch
            if (branchSearch && !branchName.includes(branchSearch.toLowerCase())) ok = false;

            // 🔎 Code
            if (codeSearch && !code.includes(codeSearch.toLowerCase())) ok = false;

            // 🔎 Item
            if (itemSearch && !itemName.includes(itemSearch.toLowerCase())) ok = false;

            // 🔎 Mark
            if (markSearch && !markName.includes(markSearch.toLowerCase())) ok = false;

            // other filters...
            if (manFilter && String(item.man) !== String(manFilter)) ok = false;
            if (planFilter && item.plan !== planFilter) ok = false;

            if (dateRange && dateRange.length === 2) {
                const d = dayjs(item.ddate);
                if (
                    d.isBefore(dayjs(dateRange[0]).startOf("day")) ||
                    d.isAfter(dayjs(dateRange[1]).endOf("day"))
                ) {
                    ok = false;
                }
            }

            return ok;
        });
    }, [
        data,
        branchSearch,
        codeSearch,   // 👈 ADD THIS
        itemSearch,
        markSearch,
        manFilter,
        planFilter,
        dateRange,
        branchMap
    ]);

    // ================= UNIQUE USERS =================
    const mans = useMemo(() => {
        return [...new Set(data.map((d) => String(d.man)))];
    }, [data]);

    // ================= FORMATTERS =================
    const formatDate = (val) => {
        if (!val) return "";
        return dayjs(val).format("YYYY-MM-DD");
    };

    const formatDecimal = (val) => {
        if (val === null || val === undefined) return "";
        return Number(val).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const formatInteger = (val) => {
        if (val === null || val === undefined) return "";
        return Number(val).toLocaleString();
    };

    const formatPercent = (value, total) => {
        const totalNumber = Number(total) || 0;
        if (!totalNumber) return "0";
        return (((Number(value) || 0) / totalNumber) * 100).toFixed(1);
    };

    const progressDisplayRows = useMemo(() => {
        const statisticByBranch = progressRows.reduce((acc, row) => {
            acc[String(row.dcode)] = row;
            return acc;
        }, {});

        const branchStatsByBranch = progressBranchStats.reduce((acc, row) => {
            const branchId = String(row.branchId);
            if (!acc[branchId]) {
                acc[branchId] = {
                    service: row.service,
                    shortName: row.shortName,
                    orders: 0,
                    qty: 0,
                    amount: 0,
                };
            }

            acc[branchId].orders += Number(row.orders) || 0;
            acc[branchId].qty += Number(row.qty) || 0;
            acc[branchId].amount += Number(row.amount) || 0;

            return acc;
        }, {});

        const sourceBranchMap = new Map();

        branches.forEach((branch) => {
            sourceBranchMap.set(String(branch.id), branch);
        });

        progressBranchStats.forEach((row) => {
            const branchId = String(row.branchId);
            if (!sourceBranchMap.has(branchId)) {
                sourceBranchMap.set(branchId, {
                    id: branchId,
                    branch: row.shortName || branchId,
                    shortName: row.shortName,
                    service: row.service || "Бусад",
                });
            }
        });

        progressRows.forEach((row) => {
            const dcode = String(row.dcode);
            if (!sourceBranchMap.has(dcode)) {
                sourceBranchMap.set(dcode, {
                    id: dcode,
                    branch: dcode,
                    service: "Бусад",
                });
            }
        });

        const sourceBranches = Array.from(sourceBranchMap.values());

        const normalizedRows = sourceBranches.map((branch, index) => {
            const dcode = String(branch.id);
            const statistic = statisticByBranch[dcode] || {};
            const branchStat = branchStatsByBranch[dcode] || {};
            const row = {
                key: dcode || `branch-${index}`,
                dcode,
                branchName: branch.branch || branch.shortName || dcode,
                service: branch.service || branchStat.service || "Бусад",
                branchOrders: Number(branchStat.orders) || 0,
                branchQty: Number(branchStat.qty) || 0,
                branchAmount: Number(branchStat.amount) || 0,
            };

            PROGRESS_NUMBER_FIELDS.forEach((field) => {
                row[field] = Number(statistic[field]) || 0;
            });

            return row;
        });

        const grouped = normalizedRows.reduce((acc, row) => {
            if (!acc[row.service]) acc[row.service] = [];
            acc[row.service].push(row);
            return acc;
        }, {});

        return Object.entries(grouped).flatMap(([service, rows]) => {
            const totals = rows.reduce((acc, row) => {
                acc.branchOrders = (acc.branchOrders || 0) + row.branchOrders;
                acc.branchQty = (acc.branchQty || 0) + row.branchQty;
                acc.branchAmount = (acc.branchAmount || 0) + row.branchAmount;
                PROGRESS_NUMBER_FIELDS.forEach((field) => {
                    acc[field] = (acc[field] || 0) + (Number(row[field]) || 0);
                });
                return acc;
            }, {});

            return rows.map((row, index) => ({
                ...row,
                alba: service,
                albaRowSpan: index === 0 ? rows.length : 0,
                albaTotals: totals,
            }));
        });
    }, [branches, progressBranchStats, progressRows]);

    const progressBranchSummary = useMemo(() => {
        return progressDisplayRows.reduce(
            (acc, row) => {
                acc.branchOrders += row.branchOrders;
                acc.branchQty += row.branchQty;
                acc.branchAmount += row.branchAmount;
                return acc;
            },
            { branchOrders: 0, branchQty: 0, branchAmount: 0 }
        );
    }, [progressDisplayRows]);

    const exportPurchaseProgressCsv = () => {
        if (!progressDisplayRows.length) {
            message.warning("CSV export хийх мөр олдсонгүй");
            return;
        }
        
        const rows = progressDisplayRows.map((row, index) => ({
            "Д.д": index + 1,
            "Салбар нэгж": row.branchName,
            "Салбар захиалга": row.branchOrders,
            "Алба": row.alba,
            "НХ рүү илгээсэн": row.albaRowSpan ? row.albaTotals?.branchOrders || 0 : "",
            "НХ рүү илгээгээгүй": row.albaRowSpan
                ? (row.albaTotals?.branchOrders || 0) - (row.albaTotals?.TotalTenders || 0)
                : "",
            "Хуваарилагдсан /НХ алба/": row.albaRowSpan ? row.albaTotals?.branchOrders || 0 : "",
            "Тендерийн явц руу орсон": row.albaRowSpan ? row.albaTotals?.branchOrders || 0 : "",
            "Тендерийн явц руу орсон/НХ алба/": row.albaRowSpan ? row.albaTotals?.TotalOrders || 0 : "",
            "get/Statistic TotalOrders": row.TotalOrders,
            "Явц % НХ-рүү илгээсэн": row.albaRowSpan
                ? Number(formatPercent(row.albaTotals?.TotalTenders, row.albaTotals?.branchOrders))
                : "",
            "Явц % Тендер": row.albaRowSpan
                ? Number(formatPercent(row.albaTotals?.TotalTenders, row.albaTotals?.TotalOrders))
                : "",
        }));

        rows.push({
            "Д.д": "",
            "Салбар нэгж": "БҮГД ДҮН",
            "Салбар захиалга": "",
            "Алба": "",
            "НХ рүү илгээсэн": progressBranchSummary.branchOrders,
            "НХ рүү илгээгээгүй":
                (progressBranchSummary.branchOrders || 0) -
                (progressSummary?.TotalTenders || 0),
            "Хуваарилагдсан /НХ алба/": progressBranchSummary.branchOrders,
            "Тендерийн явц руу орсон": progressSummary?.TotalOrders || 0,
            "Тендерийн явц руу орсон/НХ алба/": progressSummary?.TotalOrders || 0,
            "get/Statistic TotalOrders": progressSummary?.TotalOrders || 0,
            "Явц % НХ-рүү илгээсэн": Number(
                formatPercent(progressSummary?.TotalTenders, progressBranchSummary.branchOrders)
            ),
            "Явц % Тендер": Number(
                formatPercent(progressSummary?.TotalTenders, progressSummary?.TotalOrders)
            ),
        });

        const headers = Object.keys(rows[0]);
        const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
        const csv = [
            headers.map(escapeCell).join(","),
            ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
        ].join("\r\n");
        const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "purchase_order_progress.csv";
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportPDFByMan = () => {
        if (!filteredData.length) {
            message.warning("PDF export хийх мөр олдсонгүй");
            return;
        }

        const grouped = filteredData.reduce((acc, item) => {
            const key = String(item.man || "Unknown");
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {});

        const content = Object.entries(grouped)
            .filter(([manKey]) => getUserName(manKey) !== "Овог1 Нэр")
            .sort(([a], [b]) => {
                const nameA = getUserName(a);
                const nameB = getUserName(b);
                return nameA.localeCompare(nameB);
            })
            .flatMap(([manKey, rows], index) => {
                const userName = getUserName(manKey);

                return [
                    {
                        text: `Мөр: ${rows.length}`,
                        style: "specialistSummary",
                        pageBreak: index === 0 ? undefined : "before",
                    },
                    {
                        table: {
                            headerRows: 2,
                            widths: [70, "*", "*", 45, 55, 60, 55],
                            body: [
                                [
                                    {
                                        text: `Мэргэжилтэн: ${userName}`,
                                        colSpan: 7,
                                        style: "specialistTitle",
                                    },
                                    {},
                                    {},
                                    {},
                                    {},
                                    {},
                                    {},
                                ],
                                [
                                    "Хаанаас",
                                    "Item Name",
                                    "Mark Name",
                                    "Тоо",
                                    "Үнэ",
                                    "Нийт үнэ",
                                    "Date",
                                ],
                                ...rows.map((r) => [
                                    branchMap[String(r.dcode)] || r.dcode || "",
                                    r.cr4name || "",
                                    r.crmarkname || "",
                                    formatDecimal(r.qty),
                                    formatDecimal(r.price),
                                    formatDecimal(calculateItemTotal(r)),
                                    formatDate(r.ddate),
                                ]),
                            ],
                        },
                        layout: "lightHorizontalLines",
                    },
                ];
            });

        if (!content.length) {
            message.warning("PDF export хийх мэргэжилтний мэдээлэл олдсонгүй");
            return;
        }

        pdfMake
            .createPdf({
                pageSize: "A4",
                pageOrientation: "landscape",
                pageMargins: [24, 24, 24, 24],
                content: [
                    {
                        text: "Нийт захиалга - Мэргэжилтнээр",
                        style: "title",
                    },
                    {
                        text: `Экспорт хийсэн огноо: ${dayjs().format("YYYY-MM-DD HH:mm")}`,
                        style: "exportDate",
                    },
                    ...content,
                ],
                defaultStyle: {
                    fontSize: 8,
                },
                styles: {
                    title: {
                        fontSize: 16,
                        bold: true,
                        margin: [0, 0, 0, 6],
                    },
                    exportDate: {
                        fontSize: 9,
                        color: "#555555",
                        margin: [0, 0, 0, 12],
                    },
                    specialistTitle: {
                        fontSize: 12,
                        bold: true,
                        margin: [0, 4, 0, 4],
                    },
                    specialistSummary: {
                        fontSize: 9,
                        color: "#555555",
                        margin: [0, 0, 0, 6],
                    },
                },
            })
            .download("orders_by_specialist.pdf");
    };

    // ================= COLUMNS =================
    const columns = [
        { title: "ID", dataIndex: "id", width: 80 },
        // { title: "Account", dataIndex: "acct", width: 120 },

        {
            title: "Хаанаас",
            width: 160,
            render: (_, r) => branchMap[String(r.dcode)] || r.dcode,
        },

        // { title: "Code", dataIndex: "code", width: 100 },

        { title: "Item Name", dataIndex: "cr4name", width: 200 },
        // { title: "Mark Name", dataIndex: "crmarkname", width: 200 },

        { title: "Тоо", dataIndex: "qty", render: formatDecimal, width: 120 },
        { title: "Үнэ", dataIndex: "price", render: formatDecimal, width: 120 },
        { title: "Нийт үнэ", key: "pricesum", render: (_, record) => formatDecimal(calculateItemTotal(record)), width: 140 },

        { title: "Doc No", dataIndex: "mdocno", width: 120 },
        { title: "Package", dataIndex: "pkgno", width: 120 },

        { title: "Date", dataIndex: "ddate", render: formatDate, width: 120 },
        { title: "Pkg Date", dataIndex: "pkgdate", render: formatDate, width: 120 },
        { title: "Delivery Date", dataIndex: "dedate", render: formatDate, width: 120 },
        { title: "Created", dataIndex: "cdate", render: formatDate, width: 120 },
        { title: "Updated", dataIndex: "udate", render: formatDate, width: 120 },
        { title: "Plan Date", dataIndex: "plandate", render: formatDate, width: 120 },
        { title: "Tech Date", dataIndex: "techdate", render: formatDate, width: 120 },

        // { title: "Measure ID", dataIndex: "measid", width: 100 },
        { title: "Unit", dataIndex: "mname", width: 100 },
        { title: "Size", dataIndex: "usize", width: 100 },

        // { title: "Branch Code", dataIndex: "dcode", width: 120 },
        {
            title: "Plan File",
            dataIndex: "planurl",
            width: 200,
            render: (text) => {
                const decodedPath = decodeUploadPath(text);

                return text ? (
                    <a
                        href={buildUploadUrl(PLAN_BASE_URL, text)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {decodedPath}
                    </a>
                ) : (
                    "-"
                );
            },
        },
        {
            title: "Tech File",
            dataIndex: "techurl",
            width: 200,
            render: (text) => {
                const decodedPath = decodeUploadPath(text);

                return text ? (
                    <a
                        href={buildUploadUrl(TECH_BASE_URL, text)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {decodedPath}
                    </a>
                ) : (
                    "-"
                );
            },
        },
        {
            title: "Мэргэжилтэн",
            width: 180,
            render: (_, r) => getUserName(r.man),
        },

        // { title: "Man Code", dataIndex: "man", width: 120 },
    ];

    const renderAlbaCell = (children, record) => ({
        children,
        props: { rowSpan: record.albaRowSpan },
    });

    const renderAlbaTotal = (record, field, formatter = formatInteger) =>
        renderAlbaCell(formatter(record.albaTotals?.[field] || 0), record);

    const progressColumns = [
        {
            title: "Д.д",
            align: "center",
            fixed: "left",
            render: (_, __, index) => index + 1,
        },
        {
            title: "Салбар нэгж",
            dataIndex: "branchName",
            fixed: "left",
            render: (branchName, record) => (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                    }}
                >
                    <span>{branchName}</span>
                    <strong>{formatInteger(record.branchOrders)}</strong>
                </div>
            ),
        },
         {
            title: "get/Statistic TotalOrders",
            align: "right",
            render: (_, record) => formatInteger(record.TotalOrders),
        },
        {
            title: "Алба",
            dataIndex: "alba",
            align: "center",
            fixed: "left",
            render: (_, record) => renderAlbaCell(record.alba, record),
        },
        {
            title: "Салбар нэгжүүдээс ирсэн захиалга",
            align: "center",
        },
        {
            title: "НХ руу илгээсэн",
            align: "right",
            render: (_, record) =>
                renderAlbaTotal(record, "branchOrders"),
        },
        {
            title: "НХ руу илгээгээгүй",
            align: "right",
        },
        {
            title: "Хуваарилагдсан /НХ алба/",
            align: "right",
            render: (_, record) =>
                renderAlbaTotal(record, "branchOrders"),
        },
        {
            title: "Тендерийн явц руу орсон/НХ алба/",

            align: "right",
            render: (_, record) =>
                renderAlbaTotal(record, "TotalOrders"),

        },
       
        {
            title: "Явц %",
            align: "center",
            children: [
                {
                    title: "НХ-рүү илгээсэн",
                    align: "right",
                },
                {
                    title: "Тендер",
                    align: "right",
                },
            ],
        },
    ];

    return (
        <div>
            {/* ================= FILTERS ================= */}
            <Space style={{ marginBottom: 16 }}>
                <Button type="primary" onClick={exportPDFByMan}>
                    Export PDF (Мэргэжилтэн)
                </Button>
                {isUdirdlaga && (
                    <Button onClick={fetchPurchaseProgress}>
                        Худалдан авалтын захиалгын явц
                    </Button>
                )}
            </Space>
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col>
                    <Input
                        placeholder="Search Branch"
                        allowClear
                        style={{ width: 220 }}
                        onChange={(e) => setBranchSearch(e.target.value)}
                    />
                </Col>
                <Col>
                    <Input
                        placeholder="Search Code"
                        allowClear
                        style={{ width: 180 }}
                        onChange={(e) => setCodeSearch(e.target.value)}
                    />
                </Col>
                <Col>
                    <Input
                        placeholder="Search Item Name"
                        allowClear
                        style={{ width: 220 }}
                        onChange={(e) => setItemSearch(e.target.value)}
                    />
                </Col>

                <Col>
                    <Input
                        placeholder="Search Mark Name"
                        allowClear
                        style={{ width: 220 }}
                        onChange={(e) => setMarkSearch(e.target.value)}
                    />
                </Col>

                <Col>
                    <Select
                        placeholder="Мэргэжилтэн"
                        allowClear
                        style={{ width: 220 }}
                        onChange={setManFilter}
                    >
                        {mans.map((m) => (
                            <Option key={m} value={m}>
                                {getUserName(m)}
                            </Option>
                        ))}
                    </Select>
                </Col>

                <Col>
                    <Select
                        placeholder="Plan"
                        allowClear
                        style={{ width: 120 }}
                        onChange={setPlanFilter}
                    >
                        <Option value="Y">Y</Option>
                        <Option value="N">N</Option>
                    </Select>
                </Col>

                <Col>
                    <RangePicker onChange={(dates) => setDateRange(dates || [])} />
                </Col>
            </Row>

            {/* ================= ROW COUNT ================= */}
            <div style={{ marginBottom: 6 }}>
                Мөр: {filteredData.length} / {data.length}
            </div>

            {/* ================= TABLE ================= */}
            {loading ? (
                <Spin />
            ) : (
                <>
                    <Table
                        rowKey="id"
                        dataSource={filteredData}
                        columns={columns}
                        size="small"
                        bordered
                        sticky
                        scroll={{ x: 3000, y: 800 }}
                        pagination={{
                            pageSize: 20,
                            showTotal: (total, range) =>
                                `${range[0]}-${range[1]} of ${total} rows`,
                        }}
                    />

                    {/* MSSQL style footer */}
                    <div
                        style={{
                            marginTop: 6,
                            fontFamily: "Consolas, monospace",
                            fontSize: 12,
                            color: "#555",
                        }}
                    >
                        ({filteredData.length} Нийт мөр)
                    </div>
                </>
            )}

            <Modal
                title="Худалдан авалтын захиалгын явц"
                open={progressOpen}
                onCancel={() => setProgressOpen(false)}
                footer={null}
                width="95vw"
                style={{ top: 24 }}
            >
                <div
                    className="progress-print-area"
                    style={{
                        border: "1px solid #d9d9d9",
                        background:
                            "linear-gradient(#eef2f7 1px, transparent 1px), linear-gradient(90deg, #eef2f7 1px, transparent 1px)",
                        backgroundSize: "36px 24px",
                        padding: 16,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontStyle: "italic",
                            marginBottom: 18,
                        }}
                    >
                        <span>Худалдан авах ажиллагаа, борлуулалтын алба</span>
                        <span>Дотоод албан хэрэгцээнд</span>
                    </div>

                    <div style={{ textAlign: "center", fontWeight: 700, marginBottom: 16 }}>
                        Худалдан авалтын захиалгын явц
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                        <Button
                            type="primary"
                            onClick={exportPurchaseProgressCsv}
                            disabled={progressLoading || !progressDisplayRows.length}
                        >
                            CSV татах
                        </Button>
                    </div>

                    <Table
                        className="progress-print-table"
                        rowKey={(record) => record.key}
                        loading={progressLoading}
                        dataSource={progressDisplayRows}
                        columns={progressColumns}
                        size="small"
                        bordered
                        pagination={false}
                        scroll={{ x: 1450, y: 620 }}
                        summary={() =>
                            progressSummary ? (
                                <Table.Summary fixed>
                                    <Table.Summary.Row>
                                        <Table.Summary.Cell index={0} colSpan={3}>
                                            <strong>БҮГД ДҮН</strong>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={3} align="right">

                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={4} align="right">
                                            <strong>{formatInteger(progressBranchSummary.branchOrders)}</strong>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={5} align="right">
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={6} align="right">
                                            <strong>
                                                {formatInteger(
                                                    (progressBranchSummary.branchOrders || 0) -
                                                    (progressSummary.TotalTenders || 0)
                                                )}
                                            </strong>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={7} align="right">
                                            <strong>{formatInteger(progressSummary.TotalOrders)}</strong>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={8} align="right">
                                            <strong>{formatInteger(progressSummary.TotalOrders)}</strong>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={9} align="right">
                                            <strong>
                                                {formatPercent(
                                                    progressSummary.TotalTenders,
                                                    progressBranchSummary.branchOrders
                                                )}
                                            </strong>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={10} align="right">
                                            <strong>
                                                {formatPercent(
                                                    progressSummary.TotalTenders,
                                                    progressSummary.TotalOrders
                                                )}
                                            </strong>
                                        </Table.Summary.Cell>
                                    </Table.Summary.Row>
                                </Table.Summary>
                            ) : null
                        }
                    />
                </div>
            </Modal>
        </div>
    );
};

export default TotalOrders;
