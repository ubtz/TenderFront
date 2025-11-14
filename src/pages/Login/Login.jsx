import React from "react";
import { Form, Input, Button, Typography, Card, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import axios from "axios";

const { Title } = Typography;

const Login = () => {
    const API_BASE_URL = import.meta.env.VITE_API_URL;

    const onFinish = async (values) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/post/login`, values);

            if (response.data && response.data.token) {
                message.success("Login successful!");
                console.log("Login response:", response.data);

                // Save token
                localStorage.setItem("token", response.data.token);

                // Save user info
                const user = {
                    id: response.data.user.id,
                    email: response.data.user.email,
                    firstName: response.data.user.first_name,
                    lastName: response.data.user.last_name,
                    username: response.data.user.username,
                    createdAt: response.data.user.created_at,
                    code: response.data.user.code,
                    erh: response.data.user.Erh,
                };
                localStorage.setItem("data", JSON.stringify(user));

                // console.log("User info:", user);
                // Optional redirect
                window.location.href = "/";
            }
            else {
                message.error("Мэдээлэл буруу байна.");
                console.error("Login response:", response.data);
            }
        } catch (error) {
            console.error("Login failed:", error);
            message.error("Login failed. Check your credentials.");
        }
    };

    return (
        <div
            style={{
                minHeight: "50vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: "#f0f2f5",
            }}
        >
            <Card style={{ width: 350, boxShadow: "0 2px 8px #f0f1f2" }}>
                <Title level={3} style={{ textAlign: "center", marginBottom: 24 }}>
                    Нэвтрэх
                </Title>
                <Form
                    name="login_form"
                    initialValues={{ remember: true }}
                    onFinish={onFinish}
                    layout="vertical"
                >
                    <Form.Item
                        name="email"
                        label="Имэйл хаяг"
                        rules={[{ required: true, message: "Please input your email!" }]}
                    >
                        <Input
                            prefix={<UserOutlined />}
                            placeholder="Имэйл хаяг"
                            autoComplete="email"
                        />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        label="Нууц үг"
                        rules={[{ required: true, message: "Please input your password!" }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Нууц үг"
                            autoComplete="current-password"
                        />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" style={{ width: "100%" }}>
                            Log in
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default Login;
