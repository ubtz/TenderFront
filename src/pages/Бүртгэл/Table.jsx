// GroupedTable.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Table, Button, Modal } from "antd";
import { groupBy } from "lodash";
import axios from "axios";
import InventoryReportForm from "./InventoryReportForm"; // adjust path

const PLAN_BASE_URL = "http://192.168.4.119:3114/static/upload/plan";
const TECH_BASE_URL = "http://192.168.4.119:3114/static/upload/tech";
const API_BASE_URL = import.meta.env.VITE_API_URL;

const GroupedTable = ({ data, onSelectRows }) => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [branches, setBranches] = useState([]);
  const [invVisible, setInvVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [customColumnsCount, setCustomColumnsCount] = useState(0);

  const handleColumnsChange = (count) => {
    setCustomColumnsCount(count);
  };

  const modalWidth = 1000 + customColumnsCount * 150;
  useEffect(() => {
    if (!API_BASE_URL) return;
    axios
      .get(`${API_BASE_URL}/get/branches`)
      .then((res) => setBranches(res.data || []))
      .catch((err) => console.error("Error fetching branches:", err));
  }, []);

  const getServiceByShortName = useCallback(
    (shortName) => {
      const found = branches.find((b) => b.shortName === shortName);
      return found ? found.service : shortName || "";
    },
    [branches]
  );

  const groupedData = useMemo(() => {
    const grouped = groupBy(data || [], "pkgno");
    return Object.keys(grouped).map((pkgno, pkgIndex) => {
      const items = grouped[pkgno] || [];
      return {
        key: `pkg-${pkgno || "none"}-${pkgIndex}`,
        pkgno,
        pkgdate: items[0]?.pkgdate || "",
        dname: items[0]?.dname || "",
        qty: items.reduce((s, i) => s + Number(i.qty || 0), 0),
        pricesum: items.reduce((s, i) => s + Number(i.pricesum || 0), 0),
        items: items.map((it, iidx) => ({
          ...it,
          reactKey: `${pkgno || "none"}-${pkgIndex}-${iidx}`,
          key: it.key,
        })),
        planurl: items[0]?.planurl || "",
        techurl: items[0]?.techurl || "",
      };
    });
  }, [data]);

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys, selectedRows) => {
      const allKeys = [];
      selectedRows.forEach((row) => {
        allKeys.push(row.key);
        row.items.forEach((it) => allKeys.push(it.key));
      });
      setSelectedRowKeys(allKeys);
      onSelectRows?.(selectedRows);
    },
    checkStrictly: false,
  };

  const nestedColumns = [
    { title: "Нэр", dataIndex: "cr4name", key: "cr4name", width: "25%" },
    { title: "Марк", dataIndex: "crmarkname", key: "crmarkname", width: "12%" },
    {
      title: "Тоо хэмжээ",
      dataIndex: "qty",
      key: "qty",
      width: "10%",
      render: (v) => Number(v || 0).toLocaleString(),
    },
    { title: "Нэгж", dataIndex: "mname", key: "mname", width: "10%" },
    { title: "Хэмжих нэгж", dataIndex: "usize", key: "usize", width: "12%" },
    {
      title: "Үнэ",
      dataIndex: "price",
      key: "price",
      width: "13%",
      render: (v) => Number(v || 0).toLocaleString(),
    },
    {
      title: "Нийт дүн",
      dataIndex: "pricesum",
      key: "pricesum",
      width: "18%",
      render: (v) => Number(v || 0).toLocaleString(),
    },
  ];

  const handleOpenInventory = (record) => {
    setSelectedRecord(record);
    setInvVisible(true);
  };

  const handleCloseInventory = () => {
    setInvVisible(false);
    setSelectedRecord(null);
  };

  const columns = [
    { title: "Багц №", dataIndex: "pkgno", key: "pkgno", width: "5%" },
    {
      title: "Сар",
      dataIndex: "pkgdate",
      key: "pkgdate",
      width: "6%",
      render: (text) => {
        if (!text) return "";
        const d = new Date(text);
        if (isNaN(d)) return "";
        return `${d.getMonth() + 1} сар`;
      },
    },
    {
      title: "Алба",
      dataIndex: "dname",
      key: "dname",
      width: "18%",
      render: (value) => {
        const service = getServiceByShortName(value);
        return (
          <span>
            {service} <span style={{ color: "#888" }}>({value})</span>
          </span>
        );
      },
    },
    {
      title: "Нийт Тоо хэмжээ",
      dataIndex: "qty",
      key: "qty",
      width: "10%",
      render: (v) => Number(v || 0).toLocaleString(),
    },
    {
      title: "Нийт Үнэ",
      dataIndex: "pricesum",
      key: "pricesum",
      width: "12%",
      render: (v) => Number(v || 0).toLocaleString(),
    },
    {
      title: "Захиалгууд",
      key: "items",
      width: "30%",
      render: (_, record) => (
        <div key={`nested-wrapper-${record.key}`} style={{ width: "100%" }}>
          <Table
            key={`nested-${record.key}`}
            size="small"
            bordered
            pagination={false}
            scroll={{ x: "100%" }}
            columns={nestedColumns}
            dataSource={record.items}
            rowKey={(item) => item.reactKey}
          />
        </div>
      ),
    },
    {
      title: "План / Тех",
      key: "plantech",
      width: "10%",
      render: (_, record) => (
        <>
          {record.planurl && (
            <Button
              type="link"
              onClick={() =>
                window.open(
                  `${PLAN_BASE_URL}/${record.planurl.replace(/^\//, "")}`,
                  "_blank"
                )
              }
            >
              План үзэх
            </Button>
          )}
          {record.techurl && (
            <Button
              type="link"
              onClick={() =>
                window.open(
                  `${TECH_BASE_URL}/${record.techurl.replace(/^\//, "")}`,
                  "_blank"
                )
              }
            >
              Тех/Д үзэх
            </Button>
          )}
          <Button type="link" onClick={() => handleOpenInventory(record)} style={{ paddingLeft: 6 }}>
            Үлдэгдэл үзэх
          </Button>
        </>
      ),
    },
  ];

  return (
    <>
      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={groupedData}
        rowKey={(r) => r.key}
        pagination={{ pageSize: 10 }}
        bordered
        size="middle"
      />
      <Modal
        title="Бараа материалын үлдэгдэл"
        open={invVisible}
        onCancel={handleCloseInventory}
        footer={null}
        centered
        destroyOnClose
        width={modalWidth} // 👈 dynamic width here
      >
        <InventoryReportForm
          record={selectedRecord}
          onClose={handleCloseInventory}
          onColumnsChange={handleColumnsChange}  // 👈
        />

      </Modal>

    </>
  );
};

export default GroupedTable;
