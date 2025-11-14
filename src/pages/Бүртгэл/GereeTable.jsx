// src/pages/Geree/GereeTable.jsx
import React from "react";
import { Table } from "antd";
import { ProgressAction, calcCompletion } from "./GereeFieldRenderers";

const GereeTable = ({ data, loading, onRowClick }) => {
  const columns = [
    {
      title: "Гэрээний дугаар",
      dataIndex: "гэрээний_дугаар",
      width: 180,
      sorter: (a, b) =>
        (a["гэрээний_дугаар"] || "").localeCompare(b["гэрээний_дугаар"] || ""),
    },
    {
      title: "Худалдан авагч ААН",
      dataIndex: "гэрээ_байгуулсан_ААН",
      width: 220,
      sorter: (a, b) =>
        (a["гэрээ_байгуулсан_ААН"] || "").localeCompare(b["гэрээ_байгуулсан_ААН"] || ""),
    },
    {
      title: "Валют",
      dataIndex: "валют",
      width: 100,
    },
    {
      title: "Гэрээний дүн",
      dataIndex: "гэрээний_дүн",
      width: 150,
      render: (v) => (v ? Number(v).toLocaleString() : "-"),
    },
    {
      title: "Явц",
      key: "progress",
      width: 150,
      sorter: (a, b) => calcCompletion(a) - calcCompletion(b),
      render: (_, record) => <ProgressAction record={record} />,
    },
  ];

  return (
    <Table
      rowKey="GereeId"
      columns={columns}
      dataSource={data}
      loading={loading}
      bordered
      pagination={true}
      onRow={(record) => ({
        onClick: () => onRowClick(record),
        style: { cursor: "pointer" },
      })}
    />
  );
};

export default GereeTable;
