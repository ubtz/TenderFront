import DocumentTable from "./Table";
import React, { useState, useEffect } from "react";
import axios from "axios";

const Цахилгаан = () => {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const API_BASE_URL = import.meta.env.VITE_API_URL;

    useEffect(() => {
        const fetchDocuments = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`${API_BASE_URL}/get/files`);

                // ✅ Ensure result is an array
                const result = Array.isArray(response.data) ? response.data : [];

                // ✅ Filter only FileType === "Цахилгаан"
                const filtered = result.filter((item) => item.FileType === "Цахилгаан");

                // ✅ Map data
                const mapped = filtered.map((item, index) => ({
                    id: item.DocumentId,
                    Order: index + 1,
                    DocumentNumber: item.Number || `DOC-${item.DocumentId}`,
                    ValidatedDate: (item.ApprovedDate || "").split("T")[0],
                    ProcessingDate: (item.FollowDate || "").split("T")[0],
                    ValidatedSubject: item.ApprovedBy || "",
                    Name: item.Name || "",
                    canceledDate: "",
                    canceledReason: "",
                    mainFiles: item.Files?.Main || [],
                    attachments: item.Files?.Attachment || [],
                    additionals: item.Files?.Additional || [],
                }));

                // ✅ Sort by ValidatedDate (latest first)
                const sorted = mapped.sort((a, b) => {
                    const dateA = new Date(a.ValidatedDate);
                    const dateB = new Date(b.ValidatedDate);
                    return dateB - dateA; // 🔽 newest first
                });

                setDocuments(sorted);
            } catch (error) {
                console.error("❌ Failed to fetch documents:", error);
                setDocuments([]); // fallback
            } finally {
                setLoading(false);
            }
        };

        fetchDocuments();
    }, []);

    return (
        <div style={{ padding: 24 }}>
            <h1>Цахилгааны жагсаалт</h1>
            <DocumentTable initialData={documents} loading={loading} />
        </div>
    );
};

export default Цахилгаан;
