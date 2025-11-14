import React, { useState } from "react";
import {
    Card,
    Descriptions,
    Typography,
    Divider,
    Form,
    Input,
    Button,
    message,
} from "antd";
import axios from "axios";

const { Title, Text } = Typography;

const Profile = () => {
    const userJson = localStorage.getItem("data");
    const user = userJson ? JSON.parse(userJson) : null;
    const API_BASE_URL = import.meta.env.VITE_API_URL;
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    if (!user) {
        return (
            <div
                style={{
                    padding: 40,
                    textAlign: "center",
                    fontSize: 16,
                    color: "#999",
                }}
            >
                Хэрэглэгчийн мэдээлэл олдсонгүй.
            </div>
        );
    }

    const handlePasswordChange = async (values) => {
        const { oldPassword, newPassword, confirmPassword } = values;

        if (newPassword !== confirmPassword) {
            message.error("Шинэ нууц үг таарахгүй байна!");
            return;
        }

        try {
            setLoading(true);
            console.log("📤 Sending payload:", {
                userId: user.id, // check this carefully
                oldPassword,
                newPassword,
            });
            const res = await axios.post(`${API_BASE_URL}/post/UserPasswordChange`, {
                userId: user.id,
                oldPassword,
                newPassword,
            });

            if (res.status === 200) {
                message.success("Нууц үг амжилттай шинэчлэгдлээ!");
                form.resetFields();
            } else {
                message.error("Нууц үг шинэчлэхэд алдаа гарлаа.");
            }
        } catch (err) {
            console.error("❌ Password change error:", err);
            message.error(
                err.response?.data?.message || "Нууц үг шинэчлэхэд алдаа гарлаа."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                padding: "40px 20px",
                backgroundColor: "#f5f7fa",
                minHeight: "80vh",
            }}
        >
            <Card
                bordered={false}
                style={{
                    width: 600,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    borderRadius: 16,
                    background: "#fff",
                }}
            >
                {/* Profile Info */}
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <Title level={3} style={{ marginTop: 16, marginBottom: 4 }}>
                        {user.firstName} {user.lastName}
                    </Title>
                    <Text type="secondary">{user.email}</Text>
                </div>

                <Divider />

                <Descriptions
                    bordered
                    column={1}
                    size="middle"
                    labelStyle={{
                        width: "200px",
                        fontWeight: 600,
                        background: "#fafafa",
                    }}
                    contentStyle={{ background: "#fff" }}
                >
                    {/* <Descriptions.Item label="Хэрэглэгчийн код">
                        <Text strong>{user.code}</Text>
                    </Descriptions.Item> */}
                    <Descriptions.Item label="Нэр">{user.firstName}</Descriptions.Item>
                    <Descriptions.Item label="Овог">{user.lastName}</Descriptions.Item>
                    <Descriptions.Item label="Имэйл">{user.email}</Descriptions.Item>
                    <Descriptions.Item label="Эрх">{user.erh}</Descriptions.Item>
                    <Descriptions.Item label="Бүртгүүлсэн огноо">
                        {new Date(user.createdAt).toLocaleString()}
                    </Descriptions.Item>
                </Descriptions>

                {/* Password Change Section */}
                <Divider style={{ margin: "40px 0 20px" }} />
                <Title level={4} style={{ textAlign: "center", marginBottom: 20 }}>
                    Нууц үг шинэчлэх
                </Title>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handlePasswordChange}
                    style={{ maxWidth: 400, margin: "0 auto" }}
                >
                    <Form.Item
                        label="Хуучин нууц үг"
                        name="oldPassword"
                        rules={[{ required: true, message: "Хуучин нууц үгээ оруулна уу!" }]}
                    >
                        <Input.Password placeholder="••••••••" />
                    </Form.Item>

                    <Form.Item
                        label="Шинэ нууц үг"
                        name="newPassword"
                        rules={[{ required: true, message: "Шинэ нууц үгээ оруулна уу!" }]}
                    >
                        <Input.Password placeholder="••••••••" />
                    </Form.Item>

                    <Form.Item
                        label="Шинэ нууц үг давтах"
                        name="confirmPassword"
                        rules={[{ required: true, message: "Шинэ нууц үгээ дахин оруулна уу!" }]}
                    >
                        <Input.Password placeholder="••••••••" />
                    </Form.Item>

                    <Form.Item style={{ textAlign: "center", marginTop: 20 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            style={{ width: 200 }}
                        >
                            Шинэчлэх
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default Profile;
