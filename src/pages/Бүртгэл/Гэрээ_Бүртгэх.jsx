import React, { useState, useEffect, useMemo } from "react";
import { Button, message, Modal } from "antd";
import axios from "axios";
import GereeTable from "./GereeTable";
import GereeModal from "./GereeModal";

const Geree = () => {
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const [gereenuud, setGereenuud] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiToken, setApiToken] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const user = JSON.parse(localStorage.getItem("data") || "{}");

  useEffect(() => {
    fetchGeree();
  }, []);

  const fetchGeree = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/get/GetGeree`);
      const all = res.data || [];
      const role = user?.erh || "";
      const currentUserId = user?.id;
      console.log("Fetched geree:", user);
      const filtered =
        role === "Удирдлага" ? all : all.filter((g) => g.GereeUserId === currentUserId);
      setGereenuud(filtered);
    } catch (err) {
      console.error("❌ Fetch failed:", err);
      message.error("Гэрээний мэдээлэл татахад алдаа гарлаа!");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id, field, value) => {
    try {
      await axios.put(`${API_BASE_URL}/put/UpdateGeree/${id}`, { field, value });
      message.success(`${field} шинэчлэгдлээ`);
      fetchGeree();
    } catch {
      message.error("Шинэчлэхэд алдаа гарлаа");
    }
  };

  const getNewToken = async () => {
    try {
      const res = await axios.post("http://192.168.4.107:8008/v1/token/gtoken", {
        Username: "coss.api.lib.nrp",
        Password: "coss.api.lib.nrp.",
      });
      setApiToken(res.data.tokendata);
      return res.data.tokendata;
    } catch {
      message.error("Token авахад алдаа гарлаа");
      return null;
    }
  };

  const fetchClientInfo = async (reg) => {
    try {
      let token = apiToken || (await getNewToken());
      const res = await axios.post("http://192.168.4.107:8008/v1/orders/client", {
        Value: reg,
        Token: token,
      });
      return res.data;
    } catch (err) {
      console.error("❌ Client info fetch failed:", err);
      return null;
    }
  };

  return (
    <>
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        {["2024", "2025", "2026"].map((year) => (
          <Button key={year} disabled>
            {year}
          </Button>
        ))}
      </div>

      <GereeTable
        data={gereenuud}
        loading={loading}
        onRowClick={(record) => {
          setSelectedRecord(record);
          setModalVisible(true);
        }}
      />

      <GereeModal
        visible={modalVisible}
        record={selectedRecord}
        onClose={() => setModalVisible(false)}
        user={user}
        handleUpdate={handleUpdate}
        fetchClientInfo={fetchClientInfo}
      />
    </>
  );
};

export default Geree;
