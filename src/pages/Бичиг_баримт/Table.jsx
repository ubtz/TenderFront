import React, { useState, useEffect } from "react";
import { Table, Button, Tooltip, Modal, message, DatePicker, Input, Row, Col, Descriptions, Checkbox, Space } from "antd";
const { Search } = Input;

import {
    CloseCircleOutlined,
    PrinterOutlined,
    EditOutlined,
    DeleteOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import axios from "axios";
import { SearchOutlined } from "@ant-design/icons";
import Highlighter from "react-highlight-words";

const DocumentTable = ({ initialData, loading }) => {
    const [dataSource, setDataSource] = useState([]);
    const API_BASE_URL = import.meta.env.VITE_API_URL
    useEffect(() => {
        console.log("initialData received:", initialData);
        setDataSource(initialData);
    }, [initialData]);

    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [cancelDate, setCancelDate] = useState(null);
    const [cancelReason, setCancelReason] = useState("");
    const [searchText, setSearchText] = useState("");
    const [filters, setFilters] = useState({});
    const [filteredData, setFilteredData] = useState(initialData || []);

    const [editVisible, setEditVisible] = useState(false);
    const [cancelVisible, setCancelVisible] = useState(false);
    const [deleteVisible, setDeleteVisible] = useState(false);
    const [printVisible, setPrintVisible] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [searchedColumn, setSearchedColumn] = useState("");
    let searchInput = null;

    console.log("Initial Data:", initialData);
    const showEditModal = () => setEditVisible(true);
    const showDeleteModal = (id) => {
        setSelectedId(id);
        setDeleteVisible(true);
    };

    const showPrintModal = () => setPrintVisible(true);
    const showCancelModal = (record) => {
        setSelectedRecord(record);
        setCancelModalVisible(true);
    };

    const handleDelete = async () => {
        try {
            console.log("Deleting record with ID:", selectedId);
            await axios.delete(`${API_BASE_URL}/delete/file`, {
                params: { id: selectedId },
            });
            message.success("Амжилттай устгалаа");
            // Remove the deleted record from the table
            setDataSource(prev => prev.filter(item => item.id !== selectedId));
        } catch (error) {
            message.error("Устгах үед алдаа гарлаа");
            console.error(error);
        } finally {
            setDeleteVisible(false);
        }
    };
    const getColumnSearchProps = (dataIndex) => ({
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
            <div style={{ padding: 8 }}>
                <Input
                    ref={(node) => (searchInput = node)}
                    placeholder={`Хайх ${dataIndex}`}
                    value={selectedKeys[0]}
                    onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                    onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
                    style={{ marginBottom: 8, display: 'block' }}
                />
                <Space>
                    <Button
                        type="primary"
                        onClick={() => handleSearch(selectedKeys, confirm, dataIndex)}
                        icon={<SearchOutlined />}
                        size="small"
                        style={{ width: 90 }}
                    >
                        Хайх
                    </Button>
                    <Button onClick={() => handleReset(clearFilters)} size="small" style={{ width: 90 }}>
                        Цэвэрлэх
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered) => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
        onFilter: (value, record) =>
            record[dataIndex]
                ? record[dataIndex].toString().toLowerCase().includes(value.toLowerCase())
                : '',
        onFilterDropdownVisibleChange: (visible) => {
            if (visible) {
                setTimeout(() => searchInput?.select(), 100);
            }
        },
        render: (text) =>
            searchedColumn === dataIndex ? (
                <Highlighter
                    highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
                    searchWords={[searchText]}
                    autoEscape
                    textToHighlight={text ? text.toString() : ''}
                />
            ) : (
                text
            ),
    });

    const handleSearch = (selectedKeys, confirm, dataIndex) => {
        confirm();
        setSearchText(selectedKeys[0] || "");
        setSearchedColumn(dataIndex);
    };
    const handleFilterChange = (value, dataIndex) => {
        setFilters((prev) => ({ ...prev, [dataIndex]: value }));
    };
    const handleReset = (clearFilters) => {
        clearFilters();
        setSearchText("");
    };

    useEffect(() => {
        setFilteredData(
            dataSource.filter((item) =>
                Object.keys(filters).every((key) => {
                    if (!filters[key]) return true;
                    return item[key]?.toString().toLowerCase().includes(filters[key].toLowerCase());
                })
            )
        );
    }, [filters, dataSource]);

    const handleCancelOk = () => {
        if (!cancelDate || !cancelReason) {
            message.warning("Огноо болон шалтгаан оруулна уу.");
            return;
        }
        message.success("Баримт бичиг хүчингүй болголоо");
        setCancelModalVisible(false);
        setCancelDate(null);
        setCancelReason("");
    };

    const handleCancelCancel = () => {
        setCancelModalVisible(false);
        setCancelDate(null);
        setCancelReason("");
    };

    const handlePrint = (record) => {
        if (record?.mainFiles?.[0]?.Id) {
            window.open(`${API_BASE_URL}/get/file?id=${record.mainFiles[0].Id}`, "_blank");
        } else {
            message.warning("Үндсэн файл олдсонгүй");
        }
    };

    const renderFileLinks = (files) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {files.map((f, i) => (
                <Button
                    key={i}
                    type="link"
                    onClick={() => window.open(`${API_BASE_URL}/get/file?id=${f.Id}`, "_blank")}
                >
                    {f.FileName}
                </Button>
            ))}
        </div>
    );

    const columns = [
        {
            title: "Д.д",
            dataIndex: "Order",
            key: "Order",
            width: 50, // 👈 px-ээр өгнө
            align: "center", // хүсвэл төвд байрлуулах
        },
        {
            title: (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        height: 60, // header height
                        justifyContent: "flex-end", // stick to bottom
                    }}
                >
                    <span style={{ marginBottom: 4 }}>Баримт бичгийн дугаар</span>
                    <Input
                        placeholder="Хайх"
                        onChange={(e) => handleFilterChange(e.target.value, "DocumentNumber")}
                        size="small"
                    />
                </div>
            ),
            dataIndex: "DocumentNumber",
            key: "DocumentNumber",
            width: 180,
            align: "center",
        },

        {
            title: (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        height: 60, // header height
                        justifyContent: "flex-end", // stick to bottom
                    }}
                >
                    <span style={{ marginBottom: 4 }}>Батлагдсан огноо</span>
                    <Input
                        placeholder="Хайх"
                        onChange={(e) => handleFilterChange(e.target.value, "ValidatedDate")}
                        size="small"
                    />
                </div>
            ),
            dataIndex: "ValidatedDate",
            key: "ValidatedDate",
            width: 150,   // 👈 150px өргөн
            align: "center",
        },

        {
            title: (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        height: 60, // header height
                        justifyContent: "flex-end", // stick to bottom
                    }}
                >
                    <span style={{ marginBottom: 4 }}>Дагаж мөрдөх огноо</span>
                    <Input
                        placeholder="Хайх"
                        onChange={(e) => handleFilterChange(e.target.value, "ProcessingDate")}
                        size="small"
                    />
                </div>
            ),
            dataIndex: "ProcessingDate",
            key: "ProcessingDate",
            width: 150,   // 👈 150px өргөн
            align: "center",
        },
        {
            title: (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        height: 60, // header height
                        justifyContent: "flex-end", // stick to bottom
                    }}
                >
                    <span style={{ marginBottom: 4 }}>Баталсан субъект</span>
                    <Input
                        placeholder="Хайх"
                        onChange={(e) => handleFilterChange(e.target.value, "ValidatedSubject")}
                        size="small"
                    />
                </div>
            ),
            dataIndex: "ValidatedSubject",
            key: "ValidatedSubject",
            width: 150,   // 👈 150px өргөн
            align: "center",
        },
        {
            title: (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        height: 60, // header height
                        justifyContent: "flex-end", // stick to bottom
                    }}
                >
                    <span style={{ marginBottom: 4 }}>Нэр</span>
                    <Input
                        placeholder="Хайх"
                        onChange={(e) => handleFilterChange(e.target.value, "Name")}
                        size="small"
                    />
                </div>
            ),
            dataIndex: "Name",
            key: "Name",
            align: "left",   // 👈 зүүн талд зэрэгцүүлнэ
            width: 300,   // 👈 150px өргөн
            // align: "center", // 👈 голд зэрэгцүүлэх бол
            // align: "right",  // 👈 баруун талд зэрэгцүүлэх бол
        },

        {
            title: "Файлууд",
            key: "Files",
            width: 300,
            render: (_, record) => {
                const { mainFiles = [], attachments = [], additionals = [] } = record;

                const renderFileGroup = (label, files, fileType) => {
                    if (!files.length) return null;
                    return (
                        <div style={{ marginBottom: 8 }}>
                            <strong>{label}:</strong>
                            <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
                                {files.map((file) => (
                                    <li key={file.Id}>
                                        <a
                                            href={`${API_BASE_URL}/get/file?type=${fileType}&id=${encodeURIComponent(file.Id)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download={file.FileName}
                                        >
                                            {file.FileName}
                                        </a>{" "}
                                        ({file.FileType})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                };


                return (
                    <div>
                        {renderFileGroup("Үндсэн файл", mainFiles, "main")}
                        {renderFileGroup("Хавсралт", attachments, "attachment")}
                        {renderFileGroup("Нэмэлт", additionals, "additional")}
                    </div>
                );

            },
        },
        {
            title: "Хүчингүй болсон",
            key: "Canceled",
            children: [
                {
                    title: "Огноо",
                    dataIndex: "canceledDate",
                    key: "canceledDate",
                },
                {
                    title: "Шалтгаан",
                    dataIndex: "canceledReason",
                    key: "canceledReason",
                },
            ],
        },
        {
            title: "Үйлдэл",
            key: "Action",
            render: (_, record) => (
                <div style={{ display: "flex", gap: 8 }}>
                    {/* <Tooltip title="Засах">
                        <Button icon={<EditOutlined />} onClick={showEditModal} />
                    </Tooltip>
                    <Tooltip title="Цуцлах">
                        <Button icon={<CloseCircleOutlined />} onClick={() => showCancelModal(record)} />
                    </Tooltip> */}
                    <Tooltip title="Устгах">
                        <Button
                            icon={<DeleteOutlined />}
                            danger
                            onClick={() => showDeleteModal(record.id)} // pass ID here
                        />
                    </Tooltip>
                    {/* <Tooltip title="Хэвлэх">
                        <Button icon={<PrinterOutlined />} onClick={() => handlePrint(record)} />
                    </Tooltip> */}
                </div>
            ),
        },
    ];

    return (
        <>
            <Table
                dataSource={filteredData}
                columns={columns}
                rowKey="id"
                loading={loading}
                bordered
            />

            {/* Cancel Modal */}
            <Modal
                open={cancelModalVisible}
                title="Оруулсан баримт бичиг хүчингүй болгох"
                onOk={handleCancelOk}
                onCancel={handleCancelCancel}
                okText="Хүчингүй болгох"
                cancelText="Болих"
                width={800}
            >
                <Row gutter={16}>
                    <Col span={12}>
                        <h4>Баримт бичгийн мэдээлэл:</h4>
                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="Дугаар">{selectedRecord?.DocumentNumber}</Descriptions.Item>
                            <Descriptions.Item label="Төрөл">{selectedRecord?.FileType}</Descriptions.Item>
                            <Descriptions.Item label="Нэр">{selectedRecord?.Name}</Descriptions.Item>
                            <Descriptions.Item label="Баталсан">{selectedRecord?.ValidatedSubject}</Descriptions.Item>
                            <Descriptions.Item label="Батлагдсан огноо">{selectedRecord?.ValidatedDate}</Descriptions.Item>
                            <Descriptions.Item label="Дагаж мөрдөх огноо">{selectedRecord?.ProcessingDate}</Descriptions.Item>
                        </Descriptions>
                    </Col>
                    <Col span={12}>
                        <h4>Хүчингүй болгох мэдээлэл:</h4>
                        <div style={{ marginBottom: 8 }}>
                            <label>Огноо:</label>
                            <DatePicker
                                style={{ width: "100%" }}
                                value={cancelDate}
                                onChange={setCancelDate}
                            />
                        </div>
                        <div>
                            <label>Шалтгаан:</label>
                            <Input.TextArea
                                rows={4}
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                            />
                        </div>
                    </Col>
                </Row>

                {/* Файлын жагсаалт */}
                <div style={{ marginTop: 16 }}>
                    <h4>Файлууд:</h4>
                    {[...(selectedRecord?.mainFiles || []),
                    ...(selectedRecord?.attachmentFiles || []),
                    ...(selectedRecord?.additionalFiles || [])
                    ].map((file, idx) => (
                        <Checkbox key={idx}>{file.FileName}</Checkbox>
                    ))}
                </div>
            </Modal>

            {/* Edit Modal */}
            <Modal
                title="Баримт бичгийн мэдээлэл"
                open={editVisible}
                onOk={() => setEditVisible(false)}
                onCancel={() => setEditVisible(false)}
                width={800}
            >
                <p>Засах хэсэг энд байрлана</p>
            </Modal>

            {/* Delete Modal */}
            <Modal
                title="Устгах"
                open={deleteVisible}
                onOk={handleDelete}
                onCancel={() => setDeleteVisible(false)}
                okText="Тийм"
                cancelText="Үгүй"
            >
                <p>Та энэ бичлэгийг устгахдаа итгэлтэй байна уу?</p>
            </Modal>



            {/* Print Modal (Optional if you want preview instead) */}
            <Modal
                title="Хэвлэх"
                open={printVisible}
                onOk={() => setPrintVisible(false)}
                onCancel={() => setPrintVisible(false)}
            >
                <p>Файл хэвлэх үйлдэл энд хийгдэнэ.</p>
            </Modal>
        </>
    );
};

export default DocumentTable;
