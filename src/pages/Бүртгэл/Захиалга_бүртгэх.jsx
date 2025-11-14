import React, { useState } from "react";
import { Form, Input, Button, Typography, message, DatePicker, InputNumber } from "antd";
import dayjs from "dayjs";
import axios from "axios";

const { Title } = Typography;

const Захиалга_Бүртгэх = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const API_BASE_URL = import.meta.env.VITE_API_URL;
    const userJson = localStorage.getItem("data");

    const handleFinish = async (values) => {
        setLoading(true);

        const payload = {
            basketName: values.basketName,
            planName: values.planName,
            planPartNumber: values.planPartNumber,
            category: values.category,
            publishDate: values.publishDate ? values.publishDate.format("YYYY-MM-DD") : null,
            basketNumber: values.basketNumber,
            userId: userJson ? JSON.parse(userJson).id : null,
            addedAt: dayjs().format("YYYY-MM-DD"),
        };

        try {
            const res = await axios.post(`${API_BASE_URL}/post/addBasket`, payload);
            message.success("Сагс амжилттай үүсгэгдлээ!");
            form.resetFields();
        } catch (err) {
            console.error("Error creating basket:", err);
            message.error("Сагс үүсгэхэд алдаа гарлаа.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            maxWidth: 500,
            margin: "40px auto",
            background: "#fff",
            padding: 24,
            borderRadius: 8,
            boxShadow: "0 0 8px rgba(0,0,0,0.05)"
        }}>
            <Title level={3}>Багц үүсгэх</Title>
            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
            >
                <Form.Item
                    label="Багцны нэр"
                    name="basketName"
                    rules={[{ required: true, message: "Багцны нэр оруулна уу!" }]}
                >
                    <Input placeholder="Жишээ: Нэмэлт захиалга" />
                </Form.Item>

                <Form.Item
                    label="Төлөвлөгөөний нэр (PlanName)"
                    name="planName"
                    rules={[{ required: true, message: "Төлөвлөгөөний нэр оруулна уу!" }]}
                >
                    <Input placeholder="Жишээ: Засвар 2024" />
                </Form.Item>

                <Form.Item
                    label="Төлөвлөгөөний дугаар (PlanPartNumber)"
                    name="planPartNumber"
                    rules={[{ required: true, message: "Төлөвлөгөөний дугаар оруулна уу!" }]}
                >
                    <InputNumber style={{ width: "100%" }} placeholder="" />
                </Form.Item>

                <Form.Item
                    label="Багцын дугаар (BasketNumber)"
                    name="basketNumber"
                    rules={[{ required: true, message: "Багцын дугаар оруулна уу!" }]}
                >
                    <InputNumber style={{ width: "100%" }} placeholder="" />
                </Form.Item>

                <Form.Item
                    label="Ангилал"
                    name="category"
                    rules={[{ required: true, message: "Ангилал оруулна уу!" }]}
                >
                    <Input placeholder="Жишээ: Сэлбэг" />
                </Form.Item>

                <Form.Item
                    label="Тендер зарлах огноо"
                    name="publishDate"
                    rules={[{ required: true, message: "Огноо сонгоно уу!" }]}
                >
                    <DatePicker style={{ width: "100%" }} />
                </Form.Item>



                <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} block>
                        Үүсгэх
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default Захиалга_Бүртгэх;
