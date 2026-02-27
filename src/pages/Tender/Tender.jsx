// src/pages/Tender/Tender.jsx
import React, { useEffect, useState } from "react";
import { Button, message } from "antd";
import axios from "axios";
import TenderTable from "./TenderTable";
import TenderModal from "./TenderModal";
import TenderSuspendModal from "./TenderSuspendModal";

const Tender = () => {
    const API_BASE_URL = import.meta.env.VITE_API_URL;

    let user = {};
    try {
        user = JSON.parse(localStorage.getItem("data")) || {};
    } catch {
        user = {};
    }

    const [tenders, setTenders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterType, setFilterType] = useState("normal");

    // main modal
    const [selectedTender, setSelectedTender] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

    // suspend modal
    const [suspendVisible, setSuspendVisible] = useState(false);
    const [suspendDate, setSuspendDate] = useState(null);

    useEffect(() => {
        fetchTenders(filterType);
    }, [filterType]);

    const fetchTenders = async (type) => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE_URL}/get/GetTender`);
            let data = res.data || [];

            data =
                type === "normal"
                    ? data.filter(t => (t["түтгэлзүүлсэн_огноо"] || "").startsWith("1900"))
                    : data.filter(t => !(t["түтгэлзүүлсэн_огноо"] || "").startsWith("1900"));

            if (user?.erh !== "Удирдлага") {
                data = data.filter(t => t.created_by === user.id);
            }

            setTenders(data);
        } catch {
            message.error("Тендер татахад алдаа гарлаа");
        } finally {
            setLoading(false);
        }
    };

    // Tender.jsx
    const handleUpdate = async (id, field, value) => {
        try {
            await axios.put(`${API_BASE_URL}/put/UpdateTender/${id}`, {
                field,
                value,
            });

            message.success("Амжилттай хадгаллаа");

            // ✅ UPDATE CURRENTLY OPEN RECORD
            setSelectedTender((prev) => {
                if (!prev || prev.tender_id !== id) return prev;

                return {
                    ...prev,        // NEW object reference
                    [field]: value, // updated field
                };
            });

            // optional: refresh table in background
            fetchTenders(filterType);

        } catch (err) {
            message.error("Шинэчлэхэд алдаа гарлаа");
        }
    };



    return (
        <>
            {/* filters */}
            <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
                <Button
                    type={filterType === "normal" ? "primary" : "default"}
                    onClick={() => setFilterType("normal")}
                >
                    Энгийн
                </Button>
                <Button
                    danger
                    type={filterType === "suspended" ? "primary" : "default"}
                    onClick={() => setFilterType("suspended")}
                >
                    Түдгэлзүүлсэн
                </Button>
            </div>

            {/* table */}
            <TenderTable
                data={tenders}
                loading={loading}
                onRowClick={(record) => {
                    setSelectedTender(record);
                    setModalVisible(true);
                }}
            />

            {/* main modal (Geree-style) */}
            {/* main modal (Geree-style) */}
            <TenderModal
                visible={modalVisible}
                record={selectedTender}
                user={user}
                onClose={() => setModalVisible(false)}
                handleUpdate={handleUpdate}
                modalTop="10%"   // 👈 percentage of current display
            />


            {/* suspend modal */}
            <TenderSuspendModal
                visible={suspendVisible}
                date={suspendDate}
                onDateChange={setSuspendDate}
                onOk={() => {
                    handleUpdate(
                        selectedTender.tender_id,
                        "түтгэлзүүлсэн_огноо",
                        suspendDate.format("YYYY-MM-DD HH:mm:ss")
                    );
                    setSuspendVisible(false);
                    setSuspendDate(null);
                }}
                onCancel={() => setSuspendVisible(false)}
            />
        </>
    );
};

export default Tender;
