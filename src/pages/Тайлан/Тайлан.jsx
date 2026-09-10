import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert, Button, Card, Col, Input, Row, Segmented, Space,
    Statistic, Table, Tag, Typography, message,
} from "antd";
import {
    CheckCircleOutlined, ClockCircleOutlined, DownloadOutlined,
    FileDoneOutlined, InboxOutlined, ReloadOutlined, SearchOutlined, TeamOutlined,
} from "@ant-design/icons";
import axios from "axios";
import ReturnedOrders from "./ReturnedOrders";
import "./Тайлан.css";

const { Text, Title } = Typography;
const reportYears = ["2025", "2026", "2027"];
const numberValue = (value) => Number(value) || 0;

const Тайлан = () => {
    const API_BASE_URL = import.meta.env.VITE_API_URL;
    const [activeYear, setActiveYear] = useState(String(new Date().getFullYear()));
    const [report, setReport] = useState({ rows: [], summary: {}, asOf: "" });
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const requestId = useRef(0);

    const loadReport = useCallback(async () => {
        const currentRequest = ++requestId.current;
        try {
            setLoading(true);
            const response = await axios.get(`${API_BASE_URL}/get/SpecialistReport`, {
                params: { year: activeYear },
            });
            if (currentRequest !== requestId.current) return;
            setReport({
                returnedOrders: Array.isArray(response.data?.returnedOrders) ? response.data.returnedOrders : null,
                rows: Array.isArray(response.data?.rows) ? response.data.rows : [],
                summary: response.data?.summary || {},
                asOf: response.data?.asOf || "",
            });
        } catch (error) {
            if (currentRequest !== requestId.current) return;
            setReport({ rows: [], summary: {}, asOf: "", returnedOrders: null });
            console.error("Specialist report failed:", error);
            message.error(error?.response?.data?.error || "Тайлангийн мэдээлэл татахад алдаа гарлаа");
        } finally {
            if (currentRequest === requestId.current) setLoading(false);
        }
    }, [API_BASE_URL, activeYear]);

    useEffect(() => {
        loadReport();
        return () => { requestId.current += 1; };
    }, [loadReport]);

    const filteredRows = useMemo(() => {
        const keyword = search.trim().toLocaleLowerCase("mn-MN");
        if (!keyword) return report.rows;
        return report.rows.filter((row) =>
            String(row.specialistName || "").toLocaleLowerCase("mn-MN").includes(keyword)
        );
    }, [report.rows, search]);

    const visibleTotals = useMemo(
        () => filteredRows.reduce(
            (totals, row) => ({
                receivedOrders: totals.receivedOrders + numberValue(row.receivedOrders),
                bundledOrders: totals.bundledOrders + numberValue(row.bundledOrders),
                createdTenders: totals.createdTenders + numberValue(row.createdTenders),
            }),
            { receivedOrders: 0, bundledOrders: 0, createdTenders: 0 }
        ),
        [filteredRows]
    );

    const summary = report.summary;
    const columns = [
        {
            title: "№", key: "index", width: 64, align: "center",
            render: (_, __, index) => index + 1,
        },
        {
            title: "Мэргэжилтний нэр", dataIndex: "specialistName", key: "specialistName", minWidth: 230,
            render: (value) => (
                <div className="report-specialist">
                    <span className="report-specialist-avatar">
                        {String(value || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <Text strong>{value || "Нэргүй хэрэглэгч"}</Text>
                </div>
            ),
            sorter: (first, second) => String(first.specialistName).localeCompare(String(second.specialistName), "mn"),
        },
        {
            title: "НХ-д ирсэн захиалга", dataIndex: "receivedOrders", key: "receivedOrders", width: 190, align: "right",
            render: (value) => <strong>{numberValue(value).toLocaleString()}</strong>,
            sorter: (first, second) => numberValue(first.receivedOrders) - numberValue(second.receivedOrders),
        },
        {
            title: "Багцалсан захиалга", dataIndex: "bundledOrders", key: "bundledOrders", width: 190, align: "right",
            render: (value) => <Tag color="cyan">{numberValue(value).toLocaleString()}</Tag>,
            sorter: (first, second) => numberValue(first.bundledOrders) - numberValue(second.bundledOrders),
        },
        {
            title: "Багцлаагүй үлдэгдэл", key: "remainingOrders", width: 190, align: "right",
            render: (_, row) => {
                const remaining = Math.max(0, numberValue(row.receivedOrders) - numberValue(row.bundledOrders));
                return remaining > 0
                    ? <Tag color="gold">{remaining.toLocaleString()}</Tag>
                    : <Tag color="success">0</Tag>;
            },
            sorter: (first, second) =>
                (numberValue(first.receivedOrders) - numberValue(first.bundledOrders)) -
                (numberValue(second.receivedOrders) - numberValue(second.bundledOrders)),
        },
        {
            title: "Үүсгэсэн тендер", dataIndex: "createdTenders", key: "createdTenders", width: 170, align: "right",
            render: (value) => <Tag color="blue">{numberValue(value).toLocaleString()}</Tag>,
            sorter: (first, second) => numberValue(first.createdTenders) - numberValue(second.createdTenders),
        },
    ];

    const exportToCsv = () => {
        const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
        const csvRows = [
            ["Мэргэжилтний нэр", "НХ-д ирсэн захиалга", "Багцалсан захиалга", "Багцлаагүй үлдэгдэл", "Үүсгэсэн тендер"],
            ...filteredRows.map((row) => [
                row.specialistName,
                numberValue(row.receivedOrders),
                numberValue(row.bundledOrders),
                Math.max(0, numberValue(row.receivedOrders) - numberValue(row.bundledOrders)),
                numberValue(row.createdTenders),
            ]),
            ["Нийт", visibleTotals.receivedOrders, visibleTotals.bundledOrders,
                Math.max(0, visibleTotals.receivedOrders - visibleTotals.bundledOrders), visibleTotals.createdTenders],
        ];
        const blob = new Blob(
            ["\uFEFF", csvRows.map((row) => row.map(escapeCell).join(",")).join("\r\n")],
            { type: "text/csv;charset=utf-8" }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Худалдан-авах-ажиллагааны-тайлан-${activeYear}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="procurement-report-page">
            <section className="report-heading">
                <div>
                    <div className="report-eyebrow">ХУДАЛДАН АВАХ АЖИЛЛАГААНЫ ТАЙЛАН</div>
                    <Title level={2}>Цахим системд оруулсан мэдээлэл</Title>
                    <Text type="secondary">Захиалга, багцлалт болон тендерийн одоогийн төлөвийг мэргэжилтэн тус бүрээр харуулна.</Text>
                </div>
                <Space wrap className="report-actions">
                    <Segmented value={activeYear} onChange={setActiveYear} options={reportYears} />
                    <Button icon={<ReloadOutlined />} onClick={loadReport} loading={loading}>Шинэчлэх</Button>
                    <Button type="primary" icon={<DownloadOutlined />} onClick={exportToCsv} disabled={!filteredRows.length}>CSV татах</Button>
                </Space>
            </section>

            <Alert
                className="report-summary-note"
                type="info"
                showIcon
                message={`${activeYear} оны байдлаар нийт ${numberValue(summary.totalPackages).toLocaleString()} багцын ${numberValue(summary.totalOrders).toLocaleString()} захиалга бүртгэгдсэн байна.`}
                description={`Үүнээс ${numberValue(summary.acceptedPackages).toLocaleString()} багцын ${numberValue(summary.acceptedOrders).toLocaleString()} захиалгыг НХ алба хүлээн авсан. ${numberValue(summary.unacceptedPackages).toLocaleString()} багцын ${numberValue(summary.unacceptedOrders).toLocaleString()} захиалга хүлээгдэж байна.`}
            />

            <Row gutter={[14, 14]} className="report-stat-grid">
                <Col xs={24} sm={12} xl={6}>
                    <Card className="report-stat-card report-stat-card--blue">
                        <Statistic title="Нийт захиалга" value={numberValue(summary.totalOrders)} prefix={<InboxOutlined />} />
                        <span>{numberValue(summary.totalPackages).toLocaleString()} багц</span>
                    </Card>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <Card className="report-stat-card report-stat-card--green">
                        <Statistic title="НХ алба хүлээн авсан" value={numberValue(summary.acceptedOrders)} prefix={<CheckCircleOutlined />} />
                        <span>{numberValue(summary.acceptedPackages).toLocaleString()} багц</span>
                    </Card>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <Card className="report-stat-card report-stat-card--amber">
                        <Statistic title="Хүлээгдэж буй" value={numberValue(summary.unacceptedOrders)} prefix={<ClockCircleOutlined />} />
                        <span>{numberValue(summary.unacceptedPackages).toLocaleString()} багц</span>
                    </Card>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <Card className="report-stat-card report-stat-card--violet">
                        <Statistic title="Үүсгэсэн тендер" value={visibleTotals.createdTenders} prefix={<FileDoneOutlined />} />
                        <span>{report.rows.length.toLocaleString()} мэргэжилтэн</span>
                    </Card>
                </Col>
            </Row>

            <Card className="report-table-card" styles={{ body: { padding: 0 } }}>
                <div className="report-table-toolbar">
                    <div>
                        <Title level={4}><TeamOutlined /> Мэргэжилтний гүйцэтгэл</Title>
                        <Text type="secondary">{report.asOf ? `Шинэчилсэн: ${report.asOf}` : "Одоогийн мэдээлэл"}</Text>
                    </div>
                    <Input allowClear prefix={<SearchOutlined />} placeholder="Мэргэжилтний нэрээр хайх" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <Table
                    rowKey="userId"
                    columns={columns}
                    dataSource={filteredRows}
                    loading={loading}
                    pagination={false}
                    scroll={{ x: 1050 }}
                    summary={() => (
                        <Table.Summary fixed>
                            <Table.Summary.Row className="report-total-row">
                                <Table.Summary.Cell index={0} />
                                <Table.Summary.Cell index={1}><strong>Нийт</strong></Table.Summary.Cell>
                                <Table.Summary.Cell index={2} align="right"><strong>{visibleTotals.receivedOrders.toLocaleString()}</strong></Table.Summary.Cell>
                                <Table.Summary.Cell index={3} align="right"><strong>{visibleTotals.bundledOrders.toLocaleString()}</strong></Table.Summary.Cell>
                                <Table.Summary.Cell index={4} align="right"><strong>{Math.max(0, visibleTotals.receivedOrders - visibleTotals.bundledOrders).toLocaleString()}</strong></Table.Summary.Cell>
                                <Table.Summary.Cell index={5} align="right"><strong>{visibleTotals.createdTenders.toLocaleString()}</strong></Table.Summary.Cell>
                            </Table.Summary.Row>
                        </Table.Summary>
                    )}
                />
            </Card>
            <ReturnedOrders key={activeYear} orders={report.returnedOrders} year={activeYear} loading={loading} />
        </div>
    );
};

export default Тайлан;
