import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Button, Card, Input, Space, Table, Tag, Typography } from "antd";
import { DownloadOutlined, RollbackOutlined, SearchOutlined } from "@ant-design/icons";

const { Text, Title } = Typography;
const formatNumber = (value) => (Number(value) || 0).toLocaleString();
const formatDate = (value) => value ? String(value).replace("T", " ").slice(0, 19) : "—";

const columns = [
    { title: "Буцаасан мэргэжилтэн", dataIndex: "specialistName", width: 200 },
    { title: "Багцын дугаар", dataIndex: "pkgno", width: 130 },
    { title: "Багцын нэр", dataIndex: "pkgname", width: 220 },
    { title: "Багцын огноо", dataIndex: "pkgdate", width: 130, render: (value) => formatDate(value).slice(0, 10) },
    { title: "Барааны код", dataIndex: "code", width: 130 },
    { title: "Барааны нэр", dataIndex: "cr4name", width: 220 },
    { title: "Захиалагч нэгж", dataIndex: "dname", width: 180 },
    { title: "Хэмжих нэгж", dataIndex: "mname", width: 100 },
    { title: "Тоо хэмжээ", dataIndex: "qty", width: 110, align: "right", render: formatNumber },
    { title: "Нийт үнэ", dataIndex: "pricesum", width: 140, align: "right", render: formatNumber },
    { title: "Буцаасан огноо", dataIndex: "returnedAt", width: 170, render: formatDate },
    { title: "Төлөв", dataIndex: "isCancelled", width: 110,
        render: (value) => <Tag color={value ? "red" : "orange"}>{value ? "Цуцалсан" : "Буцаасан"}</Tag> },
    { title: "Буцаасан тайлбар", dataIndex: "tailbar", width: 300,
        render: (value) => <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{value || "—"}</span> },
];

export default function ReturnedOrders({ orders, year, loading }) {
    const [search, setSearch] = useState("");
    const filteredOrders = useMemo(() => {
        const keyword = search.trim().toLocaleLowerCase("mn-MN");
        return (orders || []).filter((order) => {
            const specialistName = String(order.specialistName || "").trim().replace(/\s+/g, " ");
            if (["овог1 нэр", "баяраа цолмон"].includes(specialistName.toLocaleLowerCase("mn-MN"))) return false;
            return !keyword ||
                [order.specialistName, order.pkgno, order.pkgname, order.code, order.cr4name, order.dname, order.tailbar]
                    .some((value) => String(value || "").toLocaleLowerCase("mn-MN").includes(keyword));
        });
    }, [orders, search]);
    const packageCount = new Set(filteredOrders.filter((order) => order.pkgno)
        .map((order) => JSON.stringify([order.pkgno, String(order.pkgdate).slice(0, 10)]))).size;

    const exportCsv = () => {
        const escapeCell = (value) => {
            let text = String(value ?? "");
            if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
            return `"${text.replace(/"/g, '""')}"`;
        };
        const rows = [columns.map((column) => column.title), ...filteredOrders.map((order) =>
            columns.map((column) => column.dataIndex === "isCancelled"
                ? (order.isCancelled ? "Цуцалсан" : "Буцаасан") : order[column.dataIndex]))];
        const url = URL.createObjectURL(new Blob(["\uFEFF", rows.map((row) => row.map(escapeCell).join(",")).join("\r\n")],
            { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `Буцаасан-захиалга-${year}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Card className="report-table-card report-returned-card" styles={{ body: { padding: 0 } }}>
            <div className="report-table-toolbar">
                <div>
                    <Title level={4}><RollbackOutlined /> Буцаасан</Title>
                    <Text type="secondary">Тендерийн мэргэжилтнүүдийн буцаасан захиалга · {year} оны багцын огноогоор</Text>
                    <div><Text>{packageCount.toLocaleString()} багц · {filteredOrders.length.toLocaleString()} захиалга</Text></div>
                </div>
                <Space wrap>
                    <Input allowClear prefix={<SearchOutlined />} placeholder="Мэргэжилтэн, багц, бараа, тайлбараар хайх"
                        value={search} onChange={(event) => setSearch(event.target.value)} />
                    <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={loading || !filteredOrders.length}>CSV татах</Button>
                </Space>
            </div>
            {!loading && !orders
                ? <Alert type="warning" showIcon message="Буцаасан захиалгын мэдээлэл татагдсангүй. Шинэчлэх товчийг дарж дахин оролдоно уу." />
                : <Table rowKey="basketItemId" columns={columns} dataSource={filteredOrders} loading={loading}
                    scroll={{ x: 2240 }} pagination={{ defaultPageSize: 20, showSizeChanger: true }}
                    locale={{ emptyText: search ? "Хайлтад тохирох захиалга олдсонгүй" : "Буцаасан захиалга байхгүй" }} />}
        </Card>
    );
}

ReturnedOrders.propTypes = {
    orders: PropTypes.arrayOf(PropTypes.object),
    year: PropTypes.string.isRequired,
    loading: PropTypes.bool.isRequired,
};
