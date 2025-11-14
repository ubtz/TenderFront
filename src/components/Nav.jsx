import React, { useState, useContext } from "react";
import { Layout, Menu, Modal } from "antd";
import {
  HomeOutlined,
  UserOutlined,
  FileTextOutlined,
  SettingOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import DirtyContext from "../context/DirtyContext";
import logo from "../assets/logo4.png";
import "./styles.css";

const { Sider } = Layout;

function Nav() {
  const userJson = localStorage.getItem("data");
  const user = userJson ? JSON.parse(userJson) : null;
  const accessType = user?.erh; // 👈 e.g. "Удирдлага", "Тендер мэргэжилтэн", "Гэрээний мэргэжилтэн"

  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState([]);
  const navigate = useNavigate();
  const { isDirty } = useContext(DirtyContext);

  const token = localStorage.getItem("token");
  const accessGranted = token && token.length > 0;

  const pathMap = {
    home: "/",
    Зардал: "/Зардал",
    "Ачаа тээвэр": "/Ачаа-Тээвэр",
    "Дэд бүтцийн арчилгаа": "/Дэд-бүтцийн-арчилгаа",
    "Зорчигч тээвэр": "/Зорчигч-тээвэр",
    "Зүтгүүрийн таталт": "/Зүтгүүрийн-таталт",
    "Хөдлөх бүрэлдэхүүний засвар": "/Хөдлөх-бүрэлдэхүүний-засвар",
  };
  for (let i = 1; i <= 12; i++) pathMap[`ХБ${i}`] = `/ХБ/${i}`;

  const handleMenuClick = ({ key }) => {
    const targetPath = pathMap[key];
    if (!targetPath) return;
    if (collapsed) {
      setCollapsed(false);
      return;
    }
    const proceed = () => navigate(targetPath);

    if (isDirty) {
      Modal.confirm({
        title: "Та өөрчлөлт хийсэн байна",
        content: "Хадгалаагүй өөрчлөлт устах уу?",
        okText: "Тийм",
        cancelText: "Үгүй",
        onOk: proceed,
      });
    } else {
      proceed();
    }
  };

  // 🔹 Common menu items
  const commonItems = [
    { key: "home", icon: <HomeOutlined />, label: "Нүүр" },
  ];

  // 🔹 Access-specific menus
  const udirdlagaItems = [
    {
      key: "document",
      icon: <FileTextOutlined />,
      label: "Бичиг баримт",
      children: [
        { key: "order", label: <Link to="/Тушаал">Тушаал</Link> },
        { key: "electricity", label: <Link to="/Цахилгаан">Цахилгаан</Link> },
        { key: "other", label: <Link to="/Бусад">Тендер, хууль, эрх зүй</Link> },
        { key: "add-file", label: <Link to="/Upload_Баримт">Файл нэмэх</Link> },
      ],
    },
    { key: "view", label: "Явцын мэдээлэл" },
    {
      key: "registration",
      label: "Захиалга",
      children: [
        // { key: "package-registration", label: <Link to="/Багцлах">Жагсаалт</Link> },
        { key: "tuluvluguu-registration", label: <Link to="/Төлөвлөгөө">Төлөвлөгөө</Link> },
      ],
    },
    {
      key: "tender",
      icon: <BarChartOutlined />,
      label: <Link to="/Tender">Тендер</Link>,
    },
    {
      key: "contract",
      icon: <BarChartOutlined />,
      label: <Link to="/Гэрээ_Бүртгэх">Гэрээ</Link>,
    },

    { key: "report", icon: <BarChartOutlined />, label: <Link to="/Тайлан">Тайлан</Link> },
  ];

  const tenderItems = [
    {
      key: "document",
      icon: <FileTextOutlined />,
      label: "Бичиг баримт",
      children: [
        { key: "order", label: <Link to="/Тушаал">Тушаал</Link> },
        { key: "electricity", label: <Link to="/Цахилгаан">Цахилгаан</Link> },
        { key: "other", label: <Link to="/Бусад">Тендер, хууль, эрх зүй</Link> },
        // { key: "add-file", label: <Link to="/Upload_Баримт">Файл нэмэх</Link> },
      ],
    },
    { key: "view", label: "Явцын мэдээлэл" },
    {
      key: "registration",
      label: "Захиалга",
      children: [
        { key: "package-registration", label: <Link to="/Багцлах">Жагсаалт</Link> },
        { key: "tuluvluguu-registration", label: <Link to="/Төлөвлөгөө">Төлөвлөгөө</Link> },
      ],
    },
    {
      key: "tender",
      icon: <BarChartOutlined />,
      label: <Link to="/Tender">Тендер</Link>,
    },
    { key: "report", icon: <BarChartOutlined />, label: <Link to="/Тайлан">Тайлан</Link> },

  ];

  const gereeItems = [
    {
      key: "document",
      icon: <FileTextOutlined />,
      label: "Бичиг баримт",
      children: [
        { key: "order", label: <Link to="/Тушаал">Тушаал</Link> },
        { key: "electricity", label: <Link to="/Цахилгаан">Цахилгаан</Link> },
        { key: "other", label: <Link to="/Бусад">Тендер, хууль, эрх зүй</Link> },
        // { key: "add-file", label: <Link to="/Upload_Баримт">Файл нэмэх</Link> },
      ],
    },
    { key: "view", label: "Явцын мэдээлэл" },
    {
      key: "contract",
      icon: <BarChartOutlined />,
      label: <Link to="/Гэрээ_Бүртгэх">Гэрээ</Link>,
    },
    { key: "report", icon: <BarChartOutlined />, label: <Link to="/Тайлан">Тайлан</Link> },
  ];

  const settings = [
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "Тохиргоо",
      children: [{ key: "profile", label: <Link to="/profile">Профайл тохиргоо</Link> },],
    },
  ];

  // 🔹 Combine menus based on access type
  let items = [...commonItems];

  if (accessType === "Удирдлага") {
    items = [...items, ...udirdlagaItems, ...settings];
  } else if (accessType === "Тендер мэргэжилтэн") {
    items = [...items, ...tenderItems, ...settings];
  } else if (accessType === "Гэрээний мэргэжилтэн") {
    items = [...items, ...gereeItems, ...settings];
  } else {
    // Default if no role found
    items = [...items, ...settings];
  }

  return (
    <Sider width={260} className="nav-sider">
      <div
        className="nav-logo"
        style={{
          height: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={logo}
          alt="Logo"
          style={{ height: 230, objectFit: "contain" }}
        />
      </div>

      <Menu
        disabled={!accessGranted}
        mode="inline"
        theme="light"
        items={items}
        openKeys={openKeys}
        onOpenChange={setOpenKeys}
        onClick={handleMenuClick}
        className="nav-menu"
      />

      <div
        style={{
          position: "absolute",
          bottom: 0,
          width: "100%",
          textAlign: "center",
          padding: "1rem 0",
          fontSize: 14,
          color: "#888",
        }}
      >
        © 2025 УБТЗ
      </div>
    </Sider>
  );
}

export default Nav;
