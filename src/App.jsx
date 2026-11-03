import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Layout, Avatar, message, Dropdown, Typography, Space } from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from "@ant-design/icons";

import Nav from "./components/Nav";
import NotificationCenter from "./components/NotificationCenter";
import DirtyContext from "./context/DirtyContext";
import {
  getSessionRole,
  logoutSession,
  startSessionHeartbeat,
} from "./api/session";

import PrivateRoute from "./components/PrivateRoute";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login/Login"));
const Register = lazy(() => import("./pages/Register/Register"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const Тайлан = lazy(() => import("./pages/Тайлан/Тайлан"));
const ContractReport = lazy(() => import("./pages/Тайлан/ContractReport"));
const Upload_Баримт = lazy(() => import("./pages/Бичиг_баримт/Upload_Баримт"));
const Бусад = lazy(() => import("./pages/Бичиг_баримт/Бусад"));
const Тушаал = lazy(() => import("./pages/Бичиг_баримт/Тушаал"));
const Цахилгаан = lazy(() => import("./pages/Бичиг_баримт/Цахилгаан"));
const Төлөвлөгөө = lazy(() => import("./pages/Бүртгэл/Төлөвлөгөө"));
const Хяналт = lazy(() => import("./pages/Бүртгэл/Хяналт"));
const Багцлах = lazy(() => import("./pages/Бүртгэл/Багцлах"));
const Tender_Бүртгэх = lazy(() => import("./pages/Бүртгэл/Tender_Бүртгэх"));
const Гэрээ_Бүртгэх = lazy(() => import("./pages/Бүртгэл/Гэрээ_Бүртгэх"));
const Tender = lazy(() => import("./pages/Tender/Tender"));
const Tender2 = lazy(() => import("./pages/Бүртгэл/Tender"));
const Profile = lazy(() => import("./pages/Login/Profile"));
const MeasureUnits = lazy(() => import("./pages/Тохиргоо.jsx/ХэмжихНэгж"));
const UsersPanel = lazy(() => import("./pages/Login/UsersPanel"));
const TotalOrders = lazy(() => import("./pages/Login/TotalOrders"));
const InventoryReportForm = lazy(() => import("./pages/Бүртгэл/InventoryReportForm"));
const Явц1 = lazy(() => import("./pages/Бүртгэл/Явц1"));
const Явц2 = lazy(() => import("./pages/Бүртгэл/Явц2"));
const ЯвцMain = lazy(() => import("./pages/Бүртгэл/ЯвцMain"));
const SystemRequestLogs = lazy(() => import("./pages/Admin/SystemRequestLogs"));
const BusinessAuditLogs = lazy(() => import("./pages/Admin/BusinessAuditLogs"));

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function App() {
  const [isDirty, setIsDirty] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    return startSessionHeartbeat(() => {
      message.error("Сесс дууссан тул дахин нэвтэрнэ үү");
      navigate("/login", { replace: true });
    });
  }, [navigate]);

  const accessType = getSessionRole();
  const handleMenuClick = async ({ key }) => {
    if (key === "1") navigate("/profile");
    if (key === "2") {
      await logoutSession().catch(() => {});
      localStorage.removeItem("token");
      localStorage.removeItem("data");
      message.success("Амжилттай гарлаа!");
      navigate("/login");
    }
  };

  const profileMenuItems = [
    { key: "1", icon: <SettingOutlined />, label: "Тохиргоо" },
    { key: "2", icon: <LogoutOutlined />, label: "Гарах" },
  ];

  if (location.pathname === "/login") {
    return (
      <DirtyContext.Provider value={{ isDirty, setIsDirty }}>
        <Suspense fallback={<div style={{ minHeight: "100vh", background: "#050d1a" }} />}>
          <Login />
        </Suspense>
      </DirtyContext.Provider>
    );
  }

  return (
    <DirtyContext.Provider value={{ isDirty, setIsDirty }}>
      <Layout style={{ minHeight: "auto" }}>
        {/* ✅ Sidebar */}
        <Sider width={250} style={{ background: "#fff" }}>
          <Nav />
        </Sider>

        <Layout>
          {/* ✅ Header */}
          <Header
            style={{
              background: "#fff",
              padding: "0 1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <Title
              level={4}
              style={{
                margin: 0,
                color: "#003366",
                fontWeight: 600,
                letterSpacing: "0.5px",
              }}
            >
              Худалдан авах ажиллагааны цахим систем
            </Title>

            <Space size={14} align="center">
              <NotificationCenter />
              <Dropdown
                menu={{ items: profileMenuItems, onClick: handleMenuClick }}
                placement="bottomRight"
              >
                <span>
                  <Avatar
                    icon={<UserOutlined />}
                    style={{ cursor: "pointer", backgroundColor: "#1677ff" }}
                  />
                </span>
              </Dropdown>
            </Space>
          </Header>

          {/* ✅ Main content */}
          <Content style={{ padding: "1.5rem" }}>
            <Suspense fallback={<div style={{ padding: 24 }}>Уншиж байна...</div>}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />


              {/* Profile */}
              <Route
                path="/profile"
                element={
                  <PrivateRoute>
                    <Profile />
                  </PrivateRoute>
                }
              />
              <Route
                path="/Хэмжих-нэгж"
                element={
                  <PrivateRoute>
                    <MeasureUnits />
                  </PrivateRoute>
                }
              />

              {/* Common routes (for all roles) */}
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Home />
                  </PrivateRoute>
                }
              />
              <Route
                path="/Системийн-лог"
                element={
                  <PrivateRoute allowedUserIds={[2]}>
                    <SystemRequestLogs />
                  </PrivateRoute>
                }
              />
              <Route
                path="/Бизнес-аудит"
                element={
                  <PrivateRoute allowedUserIds={[2]}>
                    <BusinessAuditLogs />
                  </PrivateRoute>
                }
              />

              {/* Common routes (for all roles) */}
              <Route
                path="/Явц1"
                element={
                  <PrivateRoute>
                    <Явц1 />
                  </PrivateRoute>
                }
              />
              <Route
                path="/Явц2"
                element={
                  <PrivateRoute>
                    <Явц2 />
                  </PrivateRoute>
                }
              />
              <Route
                path="/ЯвцMain"
                element={
                  <PrivateRoute>
                    <ЯвцMain />
                  </PrivateRoute>
                }
              />

              {/* ===================== УДИРДЛАГА ===================== */}
              {accessType === "Удирдлага" && (
                <>
                  <Route path="/register" element={<PrivateRoute allowedRoles={["Удирдлага"]}><Register /></PrivateRoute>} />
                  <Route path="/users_panel" element={<PrivateRoute allowedRoles={["Удирдлага"]}><UsersPanel /></PrivateRoute>} />
                  <Route path="/TotalOrders" element={<PrivateRoute><TotalOrders /></PrivateRoute>} />
                  <Route
                    path="/Тайлан"
                    element={
                      <PrivateRoute>
                        <Тайлан />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Upload_Баримт"
                    element={
                      <PrivateRoute>
                        <Upload_Баримт />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Бусад"
                    element={
                      <PrivateRoute>
                        <Бусад />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Тушаал"
                    element={
                      <PrivateRoute>
                        <Тушаал />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Цахилгаан"
                    element={
                      <PrivateRoute>
                        <Цахилгаан />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Tender"
                    element={
                      <PrivateRoute>
                        <Tender />
                      </PrivateRoute>
                    }
                  />
                  {/* <Route
                    path="/Багцлах"
                    element={
                      <PrivateRoute>
                        <Багцлах />
                      </PrivateRoute>
                    }
                  /> */}
                  <Route
                    path="/Төлөвлөгөө"
                    element={
                      <PrivateRoute>
                        <Төлөвлөгөө />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Tender_Бүртгэх"
                    element={
                      <PrivateRoute>
                        <Tender_Бүртгэх />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Гэрээ_Бүртгэх"
                    element={
                      <PrivateRoute>
                        <Гэрээ_Бүртгэх />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Хяналт"
                    element={
                      <PrivateRoute>
                        <Хяналт />
                      </PrivateRoute>
                    }
                  />
                </>
              )}

              {/* ===================== ТЕНДЕР МЭРГЭЖИЛТЭН ===================== */}
              {accessType === "Тендер мэргэжилтэн" && (
                <>
                  <Route path="/TotalOrders" element={<PrivateRoute><TotalOrders /></PrivateRoute>} />
                  <Route
                    path="/Тайлан"
                    element={
                      <PrivateRoute>
                        <Тайлан />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Бусад"
                    element={
                      <PrivateRoute>
                        <Бусад />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Тушаал"
                    element={
                      <PrivateRoute>
                        <Тушаал />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Цахилгаан"
                    element={
                      <PrivateRoute>
                        <Цахилгаан />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Tender"
                    element={
                      <PrivateRoute>
                        <Tender />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Tender2"
                    element={
                      <PrivateRoute>
                        <Tender2 />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Багцлах"
                    element={
                      <PrivateRoute>
                        <Багцлах />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Төлөвлөгөө"
                    element={
                      <PrivateRoute>
                        <Төлөвлөгөө />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Tender_Бүртгэх"
                    element={
                      <PrivateRoute>
                        <Tender_Бүртгэх />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/InventoryReportForm"
                    element={
                      <PrivateRoute>
                        <InventoryReportForm />
                      </PrivateRoute>
                    }
                  />

                </>
              )}

              {/* ===================== ГЭРЭЭНИЙ МЭРГЭЖИЛТЭН ===================== */}
              {accessType === "Гэрээний мэргэжилтэн" && (
                <>
                  <Route
                    path="/Тайлан"
                    element={
                      <PrivateRoute>
                        <ContractReport />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Бусад"
                    element={
                      <PrivateRoute>
                        <Бусад />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Тушаал"
                    element={
                      <PrivateRoute>
                        <Тушаал />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Цахилгаан"
                    element={
                      <PrivateRoute>
                        <Цахилгаан />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Гэрээ_Бүртгэх"
                    element={
                      <PrivateRoute>
                        <Гэрээ_Бүртгэх />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/Хяналт"
                    element={
                      <PrivateRoute>
                        <Хяналт />
                      </PrivateRoute>
                    }
                  />
                </>
              )}

              {/* Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </Suspense>
          </Content>
        </Layout>
      </Layout>
    </DirtyContext.Provider>
  );
}

export default App;
