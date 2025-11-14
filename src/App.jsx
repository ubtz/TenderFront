import React, { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { Layout, Avatar, message, Dropdown, Typography } from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from "@ant-design/icons";

import Nav from "./components/Nav";
import DirtyContext from "./context/DirtyContext";

// Pages
import Home from "./pages/Home";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import NotFoundPage from "./pages/NotFoundPage";
import Тайлан from "./pages/Тайлан/Тайлан";
import Upload_Баримт from "./pages/Бичиг_баримт/Upload_Баримт";
import Бусад from "./pages/Бичиг_баримт/Бусад";
import Тушаал from "./pages/Бичиг_баримт/Тушаал";
import Цахилгаан from "./pages/Бичиг_баримт/Цахилгаан";
import Төлөвлөгөө from "./pages/Бүртгэл/Төлөвлөгөө";
import Хяналт from "./pages/Бүртгэл/Хяналт";
import Захиалга_Бүртгэх from "./pages/Бүртгэл/Захиалга_бүртгэх";
import Багцлах from "./pages/Бүртгэл/Багцлах";
import PrivateRoute from "./components/PrivateRoute";
import Tender_Бүртгэх from "./pages/Бүртгэл/Tender_Бүртгэх";
import Гэрээ_Бүртгэх from "./pages/Бүртгэл/Гэрээ_бүртгэх";
import Tender from "./pages/Бүртгэл/Tender";
import Profile from "./pages/Login/Profile";
import UsersPanel from "./pages/Login/UsersPanel";
const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function App() {
  const [isDirty, setIsDirty] = useState(false);
  const navigate = useNavigate();

  // 🔹 Load user info & access type
  const userJson = localStorage.getItem("data");
  const user = userJson ? JSON.parse(userJson) : null;
  const accessType = user?.erh; // e.g. "Удирдлага", "Тендер мэргэжилтэн", "Гэрээний мэргэжилтэн"
  console.log("User access type:", accessType);
  const handleMenuClick = ({ key }) => {
    if (key === "1") navigate("/profile");
    if (key === "2") {
      localStorage.removeItem("token");
      message.success("Амжилттай гарлаа!");
      navigate("/login");
    }
  };

  const profileMenuItems = [
    { key: "1", icon: <SettingOutlined />, label: "Тохиргоо" },
    { key: "2", icon: <LogoutOutlined />, label: "Гарах" },
  ];

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
          </Header>

          {/* ✅ Main content */}
          <Content style={{ padding: "1.5rem" }}>
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

              {/* Common routes (for all roles) */}
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Home />
                  </PrivateRoute>
                }
              />

              {/* ===================== УДИРДЛАГА ===================== */}
              {accessType === "Удирдлага" && (
                <>
                  <Route path="/register" element={<Register />} />
                  <Route path="/users_panel" element={<UsersPanel />} />
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
                </>
              )}

              {/* ===================== ГЭРЭЭНИЙ МЭРГЭЖИЛТЭН ===================== */}
              {accessType === "Гэрээний мэргэжилтэн" && (
                <>
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
          </Content>
        </Layout>
      </Layout>
    </DirtyContext.Provider>
  );
}

export default App;
