import { useState } from "react";
import { Form, Input, Button, Typography, Card, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const { Title } = Typography;

const Login = () => {
    const API_BASE_URL = import.meta.env.VITE_API_URL;
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);

    const onFinish = async (values) => {
        setSubmitting(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/post/login`, values);

            if (!response.data?.token) {
                message.error(response.data?.error || "Нэвтрэх мэдээлэл буруу байна");
                return;
            }

            message.success("Амжилттай нэвтэрлээ");
            localStorage.setItem("token", response.data.token);

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
            navigate("/");
        } catch (error) {
            console.error("Login failed:", error);
            const serverMessage = error.response?.data?.error;
            if (!error.response) {
                message.error("Сервертэй холбогдож чадсангүй");
            } else if (error.response.status >= 500) {
                message.error(serverMessage || "Серверийн тохиргооны алдаа гарлаа");
            } else {
                message.error(serverMessage || "Нэвтрэх мэдээлэл буруу байна");
            }
        } finally {
            setSubmitting(false);
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
                <Form name="login_form" onFinish={onFinish} layout="vertical">
                    <Form.Item
                        name="email"
                        label="Имэйл хаяг"
                        rules={[{ required: true, message: "Имэйл хаягаа оруулна уу" }]}
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
                        rules={[{ required: true, message: "Нууц үгээ оруулна уу" }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Нууц үг"
                            autoComplete="current-password"
                        />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={submitting} block>
                            Нэвтрэх
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default Login;
