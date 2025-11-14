import React, { useEffect, useState, useRef } from "react";
import { Table, Button, Space, Modal, Form, Input, Select, message } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import Highlighter from "react-highlight-words";
import axios from "axios";

const { Option } = Select;
const API_BASE_URL = import.meta.env.VITE_API_URL;

const UsersPanel = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [form] = Form.useForm();

    // ✅ For search
    const [searchText, setSearchText] = useState("");
    const [searchedColumn, setSearchedColumn] = useState("");
    const searchInput = useRef(null);

    // ✅ Fetch all users
    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/get/GetUsers`);
            setUsers(res.data || []);
        } catch (error) {
            console.error("❌ Failed to load users:", error);
            message.error("Хэрэглэгчийн мэдээлэл татахад алдаа гарлаа");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // ✅ Search handlers
    const handleSearch = (selectedKeys, confirm, dataIndex) => {
        confirm();
        setSearchText(selectedKeys[0]);
        setSearchedColumn(dataIndex);
    };

    const handleReset = (clearFilters) => {
        clearFilters();
        setSearchText("");
    };

    const getColumnSearchProps = (dataIndex, placeholder) => ({
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
            <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                    ref={searchInput}
                    placeholder={placeholder || `Хайх`}
                    value={selectedKeys[0]}
                    onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                    onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
                    style={{ marginBottom: 8, display: "block" }}
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
                    <Button
                        onClick={() => clearFilters && handleReset(clearFilters)}
                        size="small"
                        style={{ width: 90 }}
                    >
                        Цэвэрлэх
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered) => (
            <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
        ),
        onFilter: (value, record) =>
            record[dataIndex]
                ? record[dataIndex].toString().toLowerCase().includes(value.toLowerCase())
                : "",
        onFilterDropdownOpenChange: (visible) => {
            if (visible) {
                setTimeout(() => searchInput.current?.select(), 100);
            }
        },
        render: (text) =>
            searchedColumn === dataIndex ? (
                <Highlighter
                    highlightStyle={{ backgroundColor: "#ffc069", padding: 0 }}
                    searchWords={[searchText]}
                    autoEscape
                    textToHighlight={text ? text.toString() : ""}
                />
            ) : (
                text
            ),
    });

    // ✅ Edit user
    const handleEdit = (record) => {
        setSelectedUser(record);
        form.setFieldsValue(record);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();

            // ✅ Combine selected user with updated form values
            const payload = { ...selectedUser, ...values };

            // ✅ Send PUT request to new API
            await axios.put(`${API_BASE_URL}/put/UserInfoUpdate`, payload);

            message.success("Хэрэглэгчийн мэдээлэл амжилттай шинэчлэгдлээ");
            setIsModalOpen(false);
            fetchUsers();
        } catch (error) {
            console.error("❌ Error updating user:", error);
            message.error("Мэдээлэл шинэчлэхэд алдаа гарлаа");
        }
    };


    // ✅ Reset password
    const handleResetPassword = async (record) => {
        Modal.confirm({
            title: "Та нууц үгийг шинэчлэх үү?",
            content: `${record.ner} (${record.email}) хэрэглэгчийн нууц үг шинэчлэгдэх бөгөөд анхны нууц үг 1234 болно.`,
            okText: "Тийм",
            cancelText: "Болих",
            onOk: async () => {
                try {
                    const res = await axios.post(`${API_BASE_URL}/post/UserPasswordRenew`, {
                        userId: record.id,
                    });
                    message.success(res.data?.message || "Нууц үг амжилттай шинэчлэгдлээ (1234)");
                } catch (error) {
                    console.error("❌ Reset password error:", error);
                    message.error("Нууц үг шинэчлэхэд алдаа гарлаа");
                }
            },
        });
    };


    // ✅ Table columns with search
    const columns = [
        {
            title: "№",
            dataIndex: "index",
            key: "index",
            width: 60,
            render: (_, __, index) => index + 1,
        },
        {
            title: "Овог",
            dataIndex: "ovog",
            key: "ovog",
            ...getColumnSearchProps("ovog", "Овгоор хайх"),
        },
        {
            title: "Нэр",
            dataIndex: "ner",
            key: "ner",
            ...getColumnSearchProps("ner", "Нэрээр хайх"),
        },
        {
            title: "Цахим хаяг",
            dataIndex: "email",
            key: "email",
            ...getColumnSearchProps("email", "Цахим хаягаар хайх"),
        },
        {
            title: "Код",
            dataIndex: "code",
            key: "code",
            ...getColumnSearchProps("code", "Кодоор хайх"),
        },
        {
            title: "Хэлтэс / Алба",
            dataIndex: "division",
            key: "division",
            ...getColumnSearchProps("division", "Хэлтсээр хайх"),
        },
        {
            title: "Эрх",
            dataIndex: "erh",
            key: "erh",
            filters: [
                { text: "Удирдлага", value: "Удирдлага" },
                { text: "Тендер мэргэжилтэн", value: "Тендер мэргэжилтэн" },
                { text: "Гэрээний мэргэжилтэн", value: "Гэрээний мэргэжилтэн" },
            ],
            onFilter: (value, record) => record.erh === value,
        },
        {
            title: "Үйлдэл",
            key: "action",
            width: 160,
            fixed: "right",
            render: (_, record) => (
                <Space size="small">
                    <Button type="link" onClick={() => handleEdit(record)}>
                        Засах
                    </Button>
                    <Button type="link" danger onClick={() => handleResetPassword(record)}>
                        Нууц үг
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <>
            <Table
                columns={columns}
                dataSource={users}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 8 }}
            // scroll={{ x: 1050 }}
            />

            {/* ✅ Edit User Modal */}
            <Modal
                title="Хэрэглэгчийн мэдээлэл засах"
                open={isModalOpen}
                onOk={handleSave}
                onCancel={() => setIsModalOpen(false)}
                okText="Хадгалах"
                cancelText="Болих"
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="ovog" label="Овог" rules={[{ required: true, message: "Овог оруулна уу" }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="ner" label="Нэр" rules={[{ required: true, message: "Нэр оруулна уу" }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="email" label="Цахим хаяг">
                        <Input />
                    </Form.Item>
                    <Form.Item name="code" label="Код">
                        <Input />
                    </Form.Item>
                    <Form.Item name="division" label="Хэлтэс / Алба">
                        <Input />
                    </Form.Item>
                    <Form.Item name="erh" label="Эрх">
                        <Select>
                            <Option value="Удирдлага">Удирдлага</Option>
                            <Option value="Тендер мэргэжилтэн">Тендер мэргэжилтэн</Option>
                            <Option value="Гэрээний мэргэжилтэн">Гэрээний мэргэжилтэн</Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default UsersPanel;
