import React, { useEffect, useState } from "react";
import { Form, Input, Button, Typography, Card, message, Select } from "antd";
import axios from "axios";

const { Title } = Typography;
const { Option } = Select;

const Register = () => {
    const [form] = Form.useForm();
    const API_BASE_URL = import.meta.env.VITE_API_URL;

    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        axios.get(`${API_BASE_URL}/get/branches`)
            .then((res) => setBranches(res.data || []))
            .catch(() => setBranches([]));
    }, []);

    // 🟢 Fetch employee info by regno
    const fetchEmployeeInfo = async () => {
        const regno = form.getFieldValue("regno");
        if (!regno) {
            message.warning("Регистрийн дугаар оруулна уу!");
            return;
        }

        try {
            setLoading(true);

            const empRes = await axios.post(`${API_BASE_URL}/external/employee`, { regno });

            const emp = empRes.data;
            // 3️⃣ Fill form fields from response
            form.setFieldsValue({
                ovog: emp.lname || "",
                ner: emp.fname || "",
                email: emp.email || "",
                dep: emp.department || "",
                division: emp.division || "",
                sector: emp.sector || "",
            });

            message.success("Ажилтны мэдээлэл амжилттай татлаа");
        } catch (err) {
            console.error("❌ Fetch employee info error:", err);
            message.error("Ажилтны мэдээлэл татаж чадсангүй");
        } finally {
            setLoading(false);
        }
    };

    // 🟣 Register to your own system
    const onFinish = async (values) => {
        try {
            await axios.post(`${API_BASE_URL}/post/register`, {
                username: "",
                password: values.password,
                ovog: values.ovog,
                ner: values.ner,
                email: values.email,
                dep: values.dep,
                code: values.code,
                Erh: values.role,
                regno: values.regno,
                department: values.dep,
                division: values.division,
                sector: values.sector,
            });
            message.success("Амжилттай бүртгэгдлээ");
            form.resetFields();
        } catch (error) {
            console.error("❌ Register error:", error);
            message.error("Бүртгэхэд алдаа гарлаа");
        }
    };

    return (
        <div
            style={{
                minHeight: "60vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f0f2f5",
            }}
        >
            <Card style={{ width: 420, boxShadow: "0 2px 8px #f0f1f2" }}>
                <Title level={2} style={{ textAlign: "center", marginBottom: 24 }}>
                    Бүртгүүлэх
                </Title>

                <Form form={form} layout="vertical" onFinish={onFinish}>
                    {/* 🆔 Регистрийн дугаар */}
                    <Form.Item
                        label="Регистрийн дугаар"
                        name="regno"
                        rules={[{ required: true, message: "Регистрийн дугаар оруулна уу!" }]}
                    >
                        <Input />
                    </Form.Item>

                    <Button
                        type="default"
                        block
                        style={{ marginBottom: 20 }}
                        onClick={fetchEmployeeInfo}
                        loading={loading}
                    >
                        🔍 Мэдээлэл татах
                    </Button>

                    {/* 🏢 Department, Division, Sector (readonly) */}
                    <Form.Item label="Хэлтэс / Тасаг" name="dep">
                        <Input placeholder="Байгууллага" readOnly />
                    </Form.Item>

                    <Form.Item label="Алба / Хэлтэс" name="division">
                        <Input placeholder="Алба" readOnly />
                    </Form.Item>

                    <Form.Item label="Салбар / Нэгж" name="sector">
                        <Input placeholder="Салбар" readOnly />
                    </Form.Item>

                    <Form.Item
                        label="Имэйл хаяг"
                        name="email"
                        rules={[
                            { required: true, message: "Имэйл хаяг оруулна уу!" },
                            { type: "email", message: "Имэйл хаяг буруу байна!" },
                        ]}
                    >
                        <Input placeholder="Имэйл хаяг"/>
                    </Form.Item>

                    <Form.Item
                        label="Овог"
                        name="ovog"
                        rules={[{ required: true, message: "Овог оруулна уу!" }]}
                    >
                        <Input placeholder="Овог" readOnly />
                    </Form.Item>

                    <Form.Item
                        label="Нэр"
                        name="ner"
                        rules={[{ required: true, message: "Нэр оруулна уу!" }]}
                    >
                        <Input placeholder="Нэр" readOnly />
                    </Form.Item>


                    <Form.Item
                        label="Код"
                        name="code"
                        rules={[{ required: true, message: "Код оруулна уу!" }]}
                    >
                        <Input placeholder="Код" />
                    </Form.Item>

                    <Form.Item
                        label="Эрх"
                        name="role"
                        rules={[{ required: true, message: "Эрхээ сонгоно уу!" }]}
                    >
                        <Select placeholder="Эрхээ сонгох">
                            <Option value="Удирдлага">Удирдлага</Option>
                            <Option value="Тендер мэргэжилтэн">Тендер мэргэжилтэн</Option>
                            <Option value="Гэрээний мэргэжилтэн">Гэрээний мэргэжилтэн</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Нууц үг"
                        name="password"
                        rules={[
                            { required: true, message: "Нууц үг оруулна уу!" },
                            { min: 4, message: "Нууц үг хамгийн багадаа 4 тэмдэгт байх ёстой." },
                        ]}
                        hasFeedback
                    >
                        <Input.Password placeholder="Нууц үг" />
                    </Form.Item>

                    <Form.Item
                        label="Нууц үг давтах"
                        name="confirm"
                        dependencies={["password"]}
                        hasFeedback
                        rules={[
                            { required: true, message: "Нууц үгээ баталгаажуулна уу!" },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue("password") === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error("Нууц үг таарахгүй байна!"));
                                },
                            }),
                        ]}
                    >
                        <Input.Password placeholder="Нууц үг давтах" />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" block>
                            Бүртгүүлэх
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default Register;
