import React from "react";
import Nav from "./Nav"; // Your existing sidebar
import { UserOutlined } from "@ant-design/icons";
// import "./layout.css";

function AppLayout({ children }) {
  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <Nav />

      {/* Right Main Area */}
      <div className="main-content">
        {/* Top Header */}
        <div className="top-header">
          <div className="profile-section">
            <UserOutlined className="profile-icon" />
          </div>
        </div>

        {/* Page Content */}
        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
