// src/pages/Tender/TenderTable.jsx
import React from "react";
import { Table, Progress } from "antd";
import { calcCompletion } from "./tender.utils";
const TenderTable = ({ data, loading, onRowClick }) => {
    const ProgressAction = ({ record }) => {
        const percent = calcCompletion(record);
        return (
            <div style={{ textAlign: "center" }}>
                <Progress percent={percent} size="small" />
            </div>
        );
    };
    const columns = [
        {
            title: "Тендерийн дугаар",
            dataIndex: "тендерийн_дугаар",
            sorter: (a, b) =>
                (a["тендерийн_дугаар"] || "").localeCompare(
                    b["тендерийн_дугаар"] || ""
                ),
        },
        {
            title: "Тендерийн нэр",
            dataIndex: "tender_name",
            ellipsis: true,
        },
        {
            title: "Явц",
            key: "progress",
            width: 250,

            sorter: (a, b) => {
                const typeA = a["тендерийн_төрөл"]?.trim();
                const typeB = b["тендерийн_төрөл"]?.trim();

                const percentA =
                    ["НТШ", "ХА"].includes(typeA)
                        ? calcCompletion(a, "default")
                        : ["Нэг эх үүсвэр", "Гэрээ шууд байгуулах"].includes(typeA)
                            ? calcCompletion(a, "zuk")
                            : 0;

                const percentB =
                    ["НТШ", "ХА"].includes(typeB)
                        ? calcCompletion(b, "default")
                        : ["Нэг эх үүсвэр", "Гэрээ шууд байгуулах"].includes(typeB)
                            ? calcCompletion(b, "zuk")
                            : 0;

                return percentA - percentB;
            },

            sortDirections: ["ascend", "descend"],

            render: (_, record) => {
                const tenderType = record["тендерийн_төрөл"]?.trim();

                if (["НТШ", "ХА"].includes(tenderType)) {
                    return <ProgressAction record={record} mode="default" />;
                }

                if (["Нэг эх үүсвэр", "Гэрээ шууд байгуулах"].includes(tenderType)) {
                    return <ProgressAction record={record} mode="zuk" />;
                }

                return null;
            },
        }

    ];

    return (
        <Table
            rowKey="tender_id"
            columns={columns}
            dataSource={data}
            loading={loading}
            bordered
            pagination
            onRow={(record) => ({
                onClick: () => onRowClick(record),
                style: { cursor: "pointer" },
            })}
        />
    );
};

export default TenderTable;
