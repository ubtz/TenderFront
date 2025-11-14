import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Table, Button } from "antd";
import { groupBy } from "lodash";
import axios from "axios";
const PLAN_BASE_URL = "http://192.168.4.119:3114/static/upload/plan";
const TECH_BASE_URL = "http://192.168.4.119:3114/static/upload/tech";
const API_BASE_URL = import.meta.env.VITE_API_URL;
const GroupedTable = ({ data, onSelectRows }) => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // ✅ Group data by pkgno, keep original keys
  const groupedData = useMemo(() => {
    const grouped = groupBy(data || [], "pkgno");

    return Object.keys(grouped).map((pkgno, pkgIndex) => {
      const items = grouped[pkgno] || [];

      return {
        key: `pkg-${pkgno || "none"}-${pkgIndex}`, // for React
        pkgno,
        pkgdate: items[0]?.pkgdate || "",
        dname: items[0]?.dname || "",
        qty: items.reduce((sum, i) => sum + Number(i.qty || 0), 0),
        pricesum: items.reduce((sum, i) => sum + Number(i.pricesum || 0), 0),

        // ✅ Keep both the React key and the original composite key
        items: items.map((it, iidx) => ({
          ...it,
          reactKey: `${pkgno || "none"}-${pkgIndex}-${iidx}`, // UI key
          key: it.key, // backend key (code-dname-dcode-price-qty-mdocno-idx)
        })),

        planurl: items[0]?.planurl || "",
        techurl: items[0]?.techurl || "",
      };
    });
  }, [data]);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/get/branches`)
      .then((res) => {
        setBranches(res.data || []);
      })
      .catch((err) => {
        console.error("❌ Error fetching branches:", err);
      });
  }, [API_BASE_URL]);
  const getServiceByShortName = useCallback(
    (shortName) => {
      const found = branches.find((b) => b.shortName === shortName);
      return found ? found.service : shortName || ""; // fallback to shortName if not found
    },
    [branches]
  );
  // ✅ Handle row selection
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

  // ✅ Nested table columns
  const nestedColumns = [
    { title: "Нэр", dataIndex: "cr4name", key: "cr4name", width: "20%" },
    { title: "Марк", dataIndex: "crmarkname", key: "crmarkname", width: "15%" },
    {
      title: "Тоо хэмжээ",
      dataIndex: "qty",
      key: "qty",
      width: "10%",
      render: (value) => Number(value || 0).toLocaleString(),
    },
    { title: "Нэгж", dataIndex: "mname", key: "mname", width: "10%" },
    { title: "Хэмжих нэгж", dataIndex: "usize", key: "usize", width: "15%" },
    {
      title: "Үнэ",
      dataIndex: "price",
      key: "price",
      width: "15%",
      render: (value) => Number(value || 0).toLocaleString(),
    },
    {
      title: "Нийт дүн",
      dataIndex: "pricesum",
      key: "pricesum",
      width: "15%",
      render: (value) => Number(value || 0).toLocaleString(),
    },
  ];

  // ✅ Main table columns
  const columns = [
    { title: "Багц №", dataIndex: "pkgno", key: "pkgno", width: "5%" },
    {
      title: "Сар",
      dataIndex: "pkgdate",
      key: "pkgdate",
      width: "5%",
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
      width: "5%",
      render: (value) => {
        const service = getServiceByShortName(value);
        return service ? (
          <span>
            {service} <span style={{ color: "#888" }}>({value})</span>
          </span>
        ) : (
          <span>{value}</span>
        );
      },
    },

    {
      title: "Нийт Тоо хэмжээ",
      dataIndex: "qty",
      key: "qty",
      width: "5%",
      render: (value) => Number(value || 0).toLocaleString(),
    },
    {
      title: "Нийт Үнэ",
      dataIndex: "pricesum",
      key: "pricesum",
      width: "5%",
      render: (value) => Number(value || 0).toLocaleString(),
    },
    {
      title: "Захиалгууд",
      key: "items",
      width: "65%",
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
            rowKey={(item) => item.reactKey} // ✅ Use reactKey here
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
        </>
      ),
    },
  ];

  return (
    <Table
      rowSelection={rowSelection}
      columns={columns}
      dataSource={groupedData}
      rowKey={(record) => record.key}
      pagination={{ pageSize: 10 }}
      bordered
      size="middle"
    />
  );
};

export default GroupedTable;
