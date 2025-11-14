import React, { useState } from "react";
import { Table, Button, Checkbox, Space, Card, Typography, Tooltip } from "antd";
import * as XLSX from "xlsx";
import { FileExcelOutlined, EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

const Тайлан = () => {
    // --- All columns ---
    const allColumns = [
        { title: "№", dataIndex: "index", key: "index", fixed: "left", width: 60, align: "center" },
        { title: "Тендер шалгаруулалтын код", dataIndex: "code", key: "code", fixed: "left", width: 140 },
        { title: "Тендер шалгаруулалтын нэр", dataIndex: "name", key: "name", fixed: "left", width: 160 },
        { title: "Багцын нэр", dataIndex: "packageName", key: "packageName", fixed: "left", width: 140 },
        { title: "Нийт төсөвт өртөг (мян.төг)", dataIndex: "totalBudget", key: "totalBudget", fixed: "left", width: 160 },
        { title: "Багцын төсөвт өртөг (мян.төг)", dataIndex: "packageBudget", key: "packageBudget", fixed: "left", width: 160 },
        { title: "Төрөл", dataIndex: "type", key: "type", width: 120 },
        { title: "Тендер шалгаруулалтын арга", dataIndex: "method", key: "method", width: 200 },
        { title: "Төлөвлөгөө, эх үүсвэр", dataIndex: "source", key: "source", width: 180 },
        { title: "Захиалагч", dataIndex: "customer", key: "customer", width: 180 },
        { title: "Хариуцсан мэргэжилтэн", dataIndex: "specialist", key: "specialist", width: 180 },
        { title: "Үнэлгээний хороо байгуулсан огноо", dataIndex: "committeeDate", key: "committeeDate", width: 200 },
        { title: "Тушаалын дугаар", dataIndex: "orderNumber", key: "orderNumber", width: 160 },
        { title: "Үнэлгээний хорооны дарга", dataIndex: "committeeHead", key: "committeeHead", width: 180 },
        { title: "Тендер зарлах хугацаа", dataIndex: "announcementPeriod", key: "announcementPeriod", width: 180 },
        { title: "Тендер зарласан огноо", dataIndex: "announcementDate", key: "announcementDate", width: 180 },
        { title: "Тендер нээсэн огноо", dataIndex: "openDate", key: "openDate", width: 180 },
        { title: "Мэдэгдэл хүргүүлсэн огноо", dataIndex: "noticeDate", key: "noticeDate", width: 200 },
        { title: "Шалгарсан этгээд", dataIndex: "winner", key: "winner", width: 180 },
        { title: "Гэрээ байгуулсан огноo", dataIndex: "contractDate", key: "contractDate", width: 180 },
        { title: "Гэрээний дугаар", dataIndex: "contractNumber", key: "contractNumber", width: 160 },
        { title: "Гэрээ байгуулсан дүн", dataIndex: "contractAmount", key: "contractAmount", width: 160 },
        { title: "Гэрээний валют", dataIndex: "currency", key: "currency", width: 140 },
        { title: "Валютын ханш", dataIndex: "exchangeRate", key: "exchangeRate", width: 140 },
        { title: "Гэрээ байгуулсан дүн (мян.төг)", dataIndex: "amountMNT", key: "amountMNT", width: 200 },
        { title: "Гомдол гарсан эсэх /СЯ болон Монополын эсрэг газар/", dataIndex: "complaint", key: "complaint", width: 300 },
        { title: "Дэлгэрэнгүй тайлбар", dataIndex: "description", key: "description", width: 300 },
    ];

    // --- Sample data ---
    const data = [
        { key: 1, index: 1, code: "TSH-001", name: "Зам барилгын ажил", packageName: "Багц 1", totalBudget: "100,000", packageBudget: "80,000", type: "Бараа", method: "НТШ", source: "ИБ" },
        { key: 2, index: 2, code: "TSH-002", name: "Сургуулийн засвар", packageName: "Багц 2", totalBudget: "200,000", packageBudget: "150,000", type: "Ажил", method: "ХА", source: "ХО" },
    ];

    const fixedColumns = allColumns.slice(0, 6);
    const optionalColumns = allColumns.slice(6);

    const [selectedKeys, setSelectedKeys] = useState([]);
    const visibleColumns = [
        ...fixedColumns,
        ...optionalColumns.filter((col) => selectedKeys.includes(col.key)),
    ];

    const handleCheckboxChange = (checkedValues) => setSelectedKeys(checkedValues);

    const exportToExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(
            data.map((row) => {
                const output = {};
                visibleColumns.forEach((col) => {
                    output[col.title] = row[col.dataIndex] || "";
                });
                return output;
            })
        );
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Тайлан");
        XLSX.writeFile(workbook, "Тайлан.xlsx");
    };

    return (
        <div
            style={{
                padding: 24,
                background: "linear-gradient(180deg, #f9fafb 0%, #eef2f7 100%)",
                minHeight: "100vh",
            }}
        >



            <Card
                style={{
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.9)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                    marginBottom: 20,
                }}
                styles={{ body: { padding: "18px 20px" } }}
            >
                <Space style={{ marginBottom: 12, flexWrap: "wrap" }}>
                    <Button
                        type="primary"
                        icon={<FileExcelOutlined />}
                        onClick={exportToExcel}
                        style={{
                            borderRadius: 8,
                            background: "linear-gradient(135deg, #22c55e, #16a34a)",
                        }}
                    >
                        Excel файл гаргах
                    </Button>

                    <Button
                        icon={
                            selectedKeys.length === optionalColumns.length ? (
                                <EyeInvisibleOutlined />
                            ) : (
                                <EyeOutlined />
                            )
                        }
                        onClick={() =>
                            setSelectedKeys(
                                selectedKeys.length === optionalColumns.length
                                    ? []
                                    : optionalColumns.map((c) => c.key)
                            )
                        }
                        style={{
                            borderRadius: 8,
                        }}
                    >
                        {selectedKeys.length === optionalColumns.length
                            ? "Бүгдийг нуух"
                            : "Бүгдийг харуулах"}
                    </Button>
                </Space>

                <div
                    style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: 12,
                        background: "#f8fafc",
                        marginBottom: 16,
                    }}
                >
                    <Text strong style={{ display: "block", marginBottom: 8, color: "#0f172a" }}>
                        Багана сонгох:
                    </Text>
                    <Checkbox.Group
                        style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}
                        value={selectedKeys}
                        onChange={handleCheckboxChange}
                    >
                        {optionalColumns.map((col) => (
                            <Tooltip key={col.key} title={col.title}>
                                <Checkbox value={col.key}>{col.title}</Checkbox>
                            </Tooltip>
                        ))}
                    </Checkbox.Group>
                </div>

                <div
                    style={{
                        borderRadius: 12,
                        overflow: "hidden",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    }}
                >
                    <Table
                        bordered
                        size="small"
                        columns={visibleColumns}
                        dataSource={data}
                        pagination={false}
                        scroll={{ x: "max-content", y: 500 }}
                        style={{ borderRadius: 12 }}
                    />
                </div>
            </Card>
        </div>
    );
};

export default Тайлан;
