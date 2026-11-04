import { useEffect, useState } from "react";
import { Button, Checkbox, Form, Input, message } from "antd";
import {
    ArrowRightOutlined,
    BarChartOutlined,
    DownOutlined,
    DownloadOutlined,
    FileTextOutlined,
    GlobalOutlined,
    LockOutlined,
    MailOutlined,
    PhoneOutlined,
    QuestionCircleOutlined,
    SafetyCertificateOutlined,
    SettingOutlined,
    ShoppingCartOutlined,
    TeamOutlined,
    UserOutlined,
} from "@ant-design/icons";
import axios from "axios";
import backgroundImage from "../../assets/background.jpg";
import brandLockup from "../../assets/ubtz_lockup_white.png";
import accessRequestPdf from "../../assets/2026.09.10 хэрэглэгч.pdf";
import { fullReloadTo } from "../../utils/sessionNavigation";
import "./Login.css";

const rememberedEmail = localStorage.getItem("rememberedLoginEmail") || "";

const Login = () => {
    const API_BASE_URL = import.meta.env.VITE_API_URL;
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        document.body.classList.add("login-page-active");
        const previousTitle = document.title;
        document.title = "Худалдан авах ажиллагааны цахим систем — Нэвтрэх";
        return () => {
            document.body.classList.remove("login-page-active");
            document.title = previousTitle;
        };
    }, []);

    const onFinish = async ({ remember, ...credentials }) => {
        setSubmitting(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/post/login`, credentials);
            if (!response.data?.token) {
                message.error(response.data?.error || "Нэвтрэх мэдээлэл буруу байна");
                return;
            }

            if (remember) localStorage.setItem("rememberedLoginEmail", credentials.email);
            else localStorage.removeItem("rememberedLoginEmail");

            localStorage.setItem("token", response.data.token);
            localStorage.setItem("data", JSON.stringify({
                id: response.data.user.id,
                email: response.data.user.email,
                firstName: response.data.user.first_name,
                lastName: response.data.user.last_name,
                username: response.data.user.username,
                createdAt: response.data.user.created_at,
                code: response.data.user.code,
                erh: response.data.user.Erh,
            }));
            fullReloadTo("/");
        } catch (error) {
            console.error("Login failed:", error);
            const serverMessage = error.response?.data?.error;
            if (!error.response) message.error("Сервертэй холбогдож чадсангүй");
            else if (error.response.status >= 500) message.error(serverMessage || "Серверийн тохиргооны алдаа гарлаа");
            else message.error(serverMessage || "Нэвтрэх мэдээлэл буруу байна");
        } finally {
            setSubmitting(false);
        }
    };

    const features = [
        { icon: <SafetyCertificateOutlined />, label: "Ил тод" },
        { icon: <SettingOutlined />, label: "Хариуцлагатай" },
        { icon: <TeamOutlined />, label: "Хамтын ажиллагаа" },
        { icon: <BarChartOutlined />, label: "Үр дүнтэй" },
    ];

    return (
        <main className="login-page" style={{ "--login-background": `url(${backgroundImage})` }}>
            <div className="login-scene" aria-hidden="true">
                <div className="login-grid-dots" />
                <div className="login-orbit login-orbit--one" />
                <div className="login-orbit login-orbit--two" />
            </div>

            <div className="login-language" aria-label="Хэл">
                <GlobalOutlined /><span>Монгол</span><DownOutlined className="login-language__arrow" />
            </div>

            <section className="login-brand-column">
                <img className="login-brand-lockup" src={brandLockup} alt="Улаанбаатар төмөр зам" />
                <div className="login-brand-content">
                    <p className="login-tagline">
                        Хариуцлагатай худалдан авалт — <strong>тогтвортой хөгжлийн үндэс</strong>
                    </p>
                    <div className="login-features">
                        {features.map((feature) => (
                            <div className="login-feature" key={feature.label}>
                                <span className="login-feature__icon">{feature.icon}</span>
                                <span>{feature.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <footer className="login-brand-footer">
                    <strong>УЛААНБААТАР ТӨМӨР ЗАМ<br />ХАМТДАА ИЛҮҮ САЙН ИРЭЭДҮЙГ БҮТЭЭЕ</strong>
                    <span>Хөгжлийн холбоос зам</span>
                </footer>
            </section>

            <section className="login-form-column">
                <div className="login-card">
                    <div className="login-card__icon"><ShoppingCartOutlined /></div>
                    <h1>Худалдан авах ажиллагааны<br />цахим систем</h1>
                    <p className="login-card__subtitle">Ил тод. Хариуцлагатай. Үр ашигтай.</p>

                    <Form
                        name="login_form"
                        onFinish={onFinish}
                        initialValues={{ email: rememberedEmail, remember: Boolean(rememberedEmail) }}
                        requiredMark={false}
                        className="login-form"
                    >
                        <Form.Item name="email" rules={[{ required: true, message: "Имэйл хаягаа оруулна уу" }]}>
                            <Input size="large" prefix={<UserOutlined />} placeholder="Имэйл хаяг" autoComplete="username" />
                        </Form.Item>
                        <Form.Item name="password" rules={[{ required: true, message: "Нууц үгээ оруулна уу" }]}>
                            <Input.Password size="large" prefix={<LockOutlined />} placeholder="Нууц үг" autoComplete="current-password" />
                        </Form.Item>
                        <div className="login-form-options">
                            <Form.Item name="remember" valuePropName="checked" noStyle>
                                <Checkbox>Намайг сана</Checkbox>
                            </Form.Item>
                            <button
                                type="button"
                                className="login-forgot"
                                onClick={() => message.info("Нууц үг сэргээхийн тулд мэдээллийн технологийн ажилтантай холбогдоно уу")}
                            >
                                Нууц үгээ мартсан уу?
                            </button>
                        </div>
                        <Button className="login-submit" type="primary" htmlType="submit" loading={submitting} block>
                            Нэвтрэх {!submitting && <ArrowRightOutlined />}
                        </Button>
                    </Form>

                    <div className="login-divider"><span>эсвэл</span></div>
                    <a
                        className="login-document-link"
                        href={accessRequestPdf}
                        download="2026.09.10 хэрэглэгч.pdf"
                    >
                        <FileTextOutlined className="login-document-link__file" />
                        <span className="login-document-link__title">Системд нэвтрэх эрх хүсэх маягт (Маягт №1)</span>
                        <DownloadOutlined className="login-document-link__download" />
                    </a>

                    <div className="login-help">
                        <span><QuestionCircleOutlined /> Тусламж хэрэгтэй юу?</span>
                        <i />
                        <span><PhoneOutlined /> 21-242166</span>
                        <i />
                        <span><MailOutlined /> Nh@ubtz.mn</span>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default Login;
