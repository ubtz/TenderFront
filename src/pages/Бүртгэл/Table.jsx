import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Dropdown,
  Empty,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  DatabaseOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  LockOutlined,
  MinusOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { groupBy } from "lodash";
import axios from "axios";
import PropTypes from "prop-types";
import InventoryReportForm from "./InventoryReportForm";
import "./Table.css";

const PLAN_BASE_URL = "http://192.168.4.119:3114/static/upload/plan";
const TECH_BASE_URL = "http://192.168.4.119:3114/static/upload/tech";
const API_BASE_URL = import.meta.env.VITE_API_URL;
const { Text } = Typography;

const unwrapValue = (value) => {
  if (!value || typeof value !== "object") return value;
  for (const key of ["String", "Int64", "Float64", "Bool", "Time"]) {
    if (value[key] !== undefined && value[key] !== null) return value[key];
  }
  return "";
};
const normalize = (value) => String(unwrapValue(value) ?? "").trim();
const toNumber = (value) => Number(normalize(value).replace(/,/g, "")) || 0;
const calculateOrderTotal = (item) => toNumber(item.price) * toNumber(item.qty);
const formatNumber = (value) => toNumber(value).toLocaleString();
const formatCposCode = (value) => {
  const original = normalize(value);
  const code = original.replace(/-/g, "");
  if (!/^\d{14}$/.test(code)) return original || "-";
  return code.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})(\d{3})$/, "$1-$2-$3-$4-$5-$6");
};
const formatDisplayDate = (value) => {
  const normalized = normalize(value);
  if (!normalized) return "";
  const match = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return match
    ? `${match[1]}/${match[2].padStart(2, "0")}/${match[3].padStart(2, "0")}`
    : normalized;
};
const itemFilterFields = [
  { key: "cr4name", label: "Барааны нэр" },
  { key: "crmarkname", label: "Марк" },
  { key: "zno", label: "Зургийн дугаар" },
  { key: "usize", label: "Нэгж" },
  { key: "crbrandname", label: "Брэнд" },
];
const openDocument = (baseUrl, path) => {
  window.open(`${baseUrl}/${normalize(path).replace(/^\//, "")}`, "_blank", "noopener,noreferrer");
};

const GroupedTable = ({
  data,
  onSelectRows,
  selectionResetToken,
  selectable = true,
  showOwner = true,
}) => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [expandedPackageKeys, setExpandedPackageKeys] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [itemFilters, setItemFilters] = useState({});
  const [branches, setBranches] = useState([]);
  const [inventoryVisible, setInventoryVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [customColumnsCount, setCustomColumnsCount] = useState(0);

  useEffect(() => {
    if (!API_BASE_URL) return;
    axios
      .get(`${API_BASE_URL}/get/branches`)
      .then((response) => setBranches(response.data || []))
      .catch((error) => console.error("Error fetching branches:", error));
  }, []);

  const branchMap = useMemo(
    () => new Map(branches.map((branch) => [branch.shortName, branch.service])),
    [branches]
  );

  const getServiceByShortName = useCallback(
    (shortName) => branchMap.get(shortName) || shortName || "-",
    [branchMap]
  );

  const groupedData = useMemo(() => {
    const grouped = groupBy(
      data || [],
      (item) => `${normalize(item.pkgno) || "none"}::${normalize(item.pkgdate) || "no-date"}`
    );

    return Object.values(grouped).map((items) => {
      const firstItem = items[0] || {};
      const pkgno = normalize(firstItem.pkgno);
      const pkgdate = normalize(firstItem.pkgdate);
      const deathdate = normalize(firstItem.deathdate);
      const parsedPackageDate = pkgdate ? new Date(pkgdate) : null;
      const year = firstItem.year || (
        parsedPackageDate && !Number.isNaN(parsedPackageDate.getTime())
          ? parsedPackageDate.getFullYear()
          : ""
      );
      const month = firstItem.month || (
        parsedPackageDate && !Number.isNaN(parsedPackageDate.getTime())
          ? parsedPackageDate.getMonth() + 1
          : ""
      );
      const claimedBy = [...new Set(items.map((item) => item.claimedBy).filter(Boolean))];
      const destinationBasketNames = [
        ...new Set(items.map((item) => item.destinationBasketName).filter(Boolean)),
      ];

      const packageKey = `pkg-${pkgno || "none"}-${pkgdate || "no-date"}`;
      return {
        key: packageKey,
        pkgno,
        pkgname: normalize(firstItem.pkgname),
        pkgdate,
        deathdate,
        year,
        month,
        dname: firstItem.dname || "",
        quantity: items.reduce((sum, item) => sum + toNumber(item.qty), 0),
        totalPrice: items.reduce((sum, item) => sum + calculateOrderTotal(item), 0),
        isLocked: items.some((item) => item.isLocked),
        claimedBy,
        destinationBasketNames,
        items: items.map((item, index) => ({
          ...item,
          calculatedPriceSum: calculateOrderTotal(item),
          reactKey: `${packageKey}-item-${normalize(item.basketItemId || item.rid || item.zno) || "row"}-${index}`,
        })),
        planurl: firstItem.planurl || "",
        techurl: firstItem.techurl || "",
      };
    });
  }, [data]);

  const filteredData = useMemo(() => {
    const query = normalize(searchText).toLocaleLowerCase();
    const activeItemFilters = itemFilterFields
      .map(({ key }) => [key, normalize(itemFilters[key]).toLocaleLowerCase()])
      .filter(([, value]) => value);

    return groupedData.filter((record) => {
      const packageValues = [
        record.pkgno,
        record.pkgname,
        record.pkgdate,
        record.year,
        record.month,
        record.dname,
        getServiceByShortName(record.dname),
        ...record.claimedBy,
      ];
      const itemValues = record.items.flatMap((item) => [
        item.cr4name,
        item.crmarkname,
        item.code,
        item.dcode,
        item.mdocno,
        item.mname,
        item.usize,
      ]);

      const matchesUniversalSearch = !query || [...packageValues, ...itemValues].some((value) =>
        normalize(value).toLocaleLowerCase().includes(query)
      );
      const matchesItemFilters = activeItemFilters.length === 0 || record.items.some((item) =>
        activeItemFilters.every(([key, value]) =>
          normalize(item[key]).toLocaleLowerCase().includes(value)
        )
      );

      return matchesUniversalSearch && matchesItemFilters;
    });
  }, [getServiceByShortName, groupedData, itemFilters, searchText]);

  const selectedRecords = useMemo(() => {
    const keys = new Set(selectedRowKeys);
    return groupedData.filter((record) => keys.has(record.key));
  }, [groupedData, selectedRowKeys]);

  const updateSelection = useCallback(
    (keys) => {
      const keySet = new Set(keys);
      const records = groupedData.filter((record) => keySet.has(record.key));
      setSelectedRowKeys(keys);
      onSelectRows?.(records);
    },
    [groupedData, onSelectRows]
  );

  useEffect(() => {
    setSelectedRowKeys([]);
    setExpandedPackageKeys([]);
    onSelectRows?.([]);
  }, [selectionResetToken, onSelectRows]);

  const togglePackageDetails = useCallback((recordKey) => {
    setExpandedPackageKeys((keys) =>
      keys.includes(recordKey)
        ? keys.filter((key) => key !== recordKey)
        : [...keys, recordKey]
    );
  }, []);

  const handleOpenInventory = (record) => {
    setSelectedRecord(record);
    setInventoryVisible(true);
  };

  const handleCloseInventory = () => {
    setInventoryVisible(false);
    setSelectedRecord(null);
  };

  const nestedColumns = [
    {
      title: "№",
      key: "number",
      width: 52,
      align: "center",
      render: (_, __, index) => <Text type="secondary">{index + 1}</Text>,
    },
    {
      title: "Барааны нэр",
      dataIndex: "cr4name",
      key: "cr4name",
      width: 170,
      ellipsis: true,
      render: (value) => <Text strong>{value || "-"}</Text>,
    },
    {
      title: "Марк",
      dataIndex: "crmarkname",
      key: "crmarkname",
      width: 190,
      ellipsis: true,
      render: (value) => value || "-",
    },
    {
      title: "Зургийн дугаар",
      dataIndex: "zno",
      key: "zno",
      width: 110,
      ellipsis: true,
      render: (value) => value || "-",
    },
    {
      title: "Нэгж",
      dataIndex: "usize",
      key: "usize",
      width: 110,
      render: (value) => value || "-",
    },
    {
      title: "Брэнд",
      dataIndex: "crbrandname",
      key: "crbrandname",
      width: 150,
      ellipsis: true,
      render: (value) => value || "-",
    },
    {
      title: "Хэмжих нэгж",
      dataIndex: "mname",
      key: "mname",
      width: 130,
      render: (value) => value || "-",
    },
    {
      title: "Код",
      dataIndex: "code",
      key: "code",
      width: 165,
      render: formatCposCode,
    },
    {
      title: (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "55px 14px 92px 14px 115px",
            justifyContent: "end",
            columnGap: 5,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ textAlign: "right" }}>Тоо</span>
          <span style={{ textAlign: "center" }}>×</span>
          <span style={{ textAlign: "right" }}>Нэгж үнэ</span>
          <span style={{ textAlign: "center" }}>=</span>
          <span style={{ textAlign: "right" }}>Нийт</span>
        </div>
      ),
      key: "amountSummary",
      width: 310,
      sorter: (first, second) => first.calculatedPriceSum - second.calculatedPriceSum,
      render: (_, record) => (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "55px 14px 92px 14px 115px",
            alignItems: "center",
            justifyContent: "end",
            columnGap: 5,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Text strong style={{ textAlign: "right" }}>{formatNumber(record.qty)}</Text>
          <Text type="secondary" style={{ textAlign: "center" }}>×</Text>
          <Text strong style={{ textAlign: "right" }}>{formatNumber(record.price)} ₮</Text>
          <Text type="secondary" style={{ textAlign: "center" }}>=</Text>
          <Text
            strong
            style={{
              color: "#32735f",
              padding: "3px 7px",
              background: "#edf8f4",
              borderRadius: 6,
              whiteSpace: "nowrap",
              textAlign: "right",
            }}
          >
            {formatNumber(record.calculatedPriceSum)} ₮
          </Text>
        </div>
      ),
    },
  ];

  const selectionColumn = {
    title: "",
    key: "selection",
    width: 66,
    fixed: "left",
    align: "center",
    render: (_, record) => {
      const selected = selectedRowKeys.includes(record.key);
      if (record.isLocked) {
        return (
          <Tooltip title={`${record.claimedBy.join(", ") || "Өөр хэрэглэгч"} авсан`}>
            <Button shape="circle" size="large" icon={<LockOutlined />} disabled />
          </Tooltip>
        );
      }

      return (
        <Button
          shape="circle"
          size="large"
          type="default"
          icon={selected ? <MinusOutlined /> : <PlusOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            const nextKeys = selected
              ? selectedRowKeys.filter((key) => key !== record.key)
              : [...selectedRowKeys, record.key];
            updateSelection(nextKeys);
          }}
          style={{
            width: 42,
            height: 42,
            color: selected ? "#963f34" : "#176b52",
            background: selected ? "#fbe1dc" : "#d9f1e8",
            borderColor: selected ? "#df9d92" : "#79bba7",
            borderWidth: 2,
            boxShadow: selected
              ? "0 3px 9px rgba(150, 63, 52, 0.16)"
              : "0 3px 9px rgba(23, 107, 82, 0.16)",
            fontSize: 19,
            fontWeight: 700,
          }}
          aria-label={selected ? "Сонголтоос хасах" : "Сонгох"}
        />
      );
    },
  };

  const columns = [
    ...(selectable ? [selectionColumn] : []),
    {
      title: "Багц",
      dataIndex: "pkgno",
      key: "pkgno",
      width: 190,
      fixed: "left",
      sorter: (first, second) => first.pkgno.localeCompare(second.pkgno),
      render: (value, record) => (
        <Space direction="vertical" size={6}>
          <Space size={8}>
            <FolderOpenOutlined
              style={{
                color: expandedPackageKeys.includes(record.key) ? "#4d829f" : "#8c8c8c",
                fontSize: 17,
              }}
            />
            <Text strong copyable={value ? { text: value } : false}>
              Багц № {value || "Дугааргүй"}
            </Text>
          </Space>
          <Tag bordered={false} style={{ background: "#f0f0f0", color: "#595959" }}>
            {record.items.length} захиалга
          </Tag>
          {record.pkgname && (
            <Text type="secondary" ellipsis={{ tooltip: record.pkgname }}>
              {record.pkgname}
            </Text>
          )}
          {record.destinationBasketNames.length > 0 && (
            <Text type="secondary" ellipsis={{ tooltip: record.destinationBasketNames.join(", ") }}>
              → {record.destinationBasketNames.join(", ")}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Огноо",
      key: "yearMonth",
      width: 145,
      align: "center",
      sorter: (first, second) => normalize(first.pkgdate).localeCompare(normalize(second.pkgdate)),
      render: (_, record) => (
        <Space direction="vertical" size={2} align="center">
          <Tag
            bordered={false}
            style={{
              margin: 0,
              borderRadius: 999,
              background: "#eaf4fb",
              color: "#3f7391",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {formatDisplayDate(record.pkgdate) || "—"}
          </Tag>
          {record.deathdate && (
            <Tag
              bordered={false}
              style={{
                margin: 0,
                borderRadius: 999,
                background: "#fff2e8",
                color: "#a7603c",
                fontSize: 11,
              }}
            >
              {formatDisplayDate(record.deathdate)}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Алба",
      dataIndex: "dname",
      key: "dname",
      width: 230,
      sorter: (first, second) => first.dname.localeCompare(second.dname),
      render: (value) => (
        <Space direction="vertical" size={0}>
          <Text>{getServiceByShortName(value)}</Text>
          {value && <Text type="secondary">{value}</Text>}
        </Space>
      ),
    },
    {
      title: "Нийт тоо",
      dataIndex: "quantity",
      key: "quantity",
      width: 125,
      align: "right",
      sorter: (first, second) => first.quantity - second.quantity,
      render: (value) => <Text>{formatNumber(value)}</Text>,
    },
    {
      title: "Нийт үнэ",
      dataIndex: "totalPrice",
      key: "totalPrice",
      width: 165,
      align: "right",
      sorter: (first, second) => first.totalPrice - second.totalPrice,
      render: (value) => <Text strong>{formatNumber(value)} ₮</Text>,
    },
    {
      title: "Эзэмшигч",
      key: "owner",
      width: 190,
      render: (_, record) => record.isLocked ? (
        <Tooltip title="Энэ багцыг өөр хэрэглэгч авсан байна">
          <Tag icon={<LockOutlined />} color="error">
            {record.claimedBy.join(", ") || "Авсан"}
          </Tag>
        </Tooltip>
      ) : null,
    },
    {
      title: "Үйлдэл",
      key: "actions",
      width: 110,
      align: "center",
      fixed: "right",
      render: (_, record) => {
        const menuItems = [
          record.planurl && {
            key: "plan",
            icon: <FileTextOutlined />,
            label: "План үзэх",
            onClick: () => openDocument(PLAN_BASE_URL, record.planurl),
          },
          record.techurl && {
            key: "tech",
            icon: <ToolOutlined />,
            label: "Техникийн баримт үзэх",
            onClick: () => openDocument(TECH_BASE_URL, record.techurl),
          },
          {
            key: "inventory",
            icon: <DatabaseOutlined />,
            label: "Үлдэгдэл үзэх",
            onClick: () => handleOpenInventory(record),
          },
        ].filter(Boolean);

        return (
          <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
            <Button size="small" icon={<MoreOutlined />}>
              Үйлдэл
            </Button>
          </Dropdown>
        );
      },
    },
  ].filter((column) => showOwner || column.key !== "owner");

  return (
    <>
      <div className="package-table-filters">
        <div className="package-table-filters__universal">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Багц, алба болон бүх мэдээллээс хайх..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            style={{ width: 360, maxWidth: "100%" }}
          />
          <Space wrap>
            <Text type="secondary">
              {filteredData.length.toLocaleString()} багц
            </Text>
            {selectable && selectedRecords.length > 0 && (
              <Tag color="processing">{selectedRecords.length} багц сонгосон</Tag>
            )}
            {expandedPackageKeys.length > 0 && (
              <Button size="small" onClick={() => setExpandedPackageKeys([])}>
                Бүгдийг хураах ({expandedPackageKeys.length})
              </Button>
            )}
          </Space>
        </div>
        <div className="package-table-filters__fields">
          {itemFilterFields.map(({ key, label }) => (
            <label className="package-table-filter-field" key={key}>
              <Text type="secondary">{label}</Text>
              <Input
                allowClear
                size="small"
                placeholder={`${label} шүүх`}
                value={itemFilters[key] || ""}
                onChange={(event) => setItemFilters((filters) => ({
                  ...filters,
                  [key]: event.target.value,
                }))}
              />
            </label>
          ))}
          {Object.values(itemFilters).some((value) => normalize(value)) && (
            <Button size="small" onClick={() => setItemFilters({})}>
              Шүүлт цэвэрлэх
            </Button>
          )}
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey="key"
        sticky
        scroll={{ x: 1100 }}
        pagination={{
          defaultPageSize: 20,
          pageSizeOptions: [10, 20, 50, 100],
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}–${range[1]} / ${total} багц`,
          position: ["bottomCenter"],
        }}
        expandable={{
          expandedRowKeys: expandedPackageKeys,
          showExpandColumn: false,
          rowExpandable: (record) => record.items.length > 0,
          expandedRowRender: (record) => {
            return (
              <div
                className="package-detail-panel"
                style={{
                  margin: "0 12px 20px",
                  background: "#fff",
                  border: "1px solid #a9cde2",
                  borderTop: 0,
                  borderRadius: "0 0 14px 14px",
                  overflow: "hidden",
                  boxShadow: "0 8px 24px rgba(31, 56, 88, 0.08)",
                }}
              >
                <div className="package-detail-owner">
                  <div className="package-detail-owner__identity">
                    <FolderOpenOutlined />
                    <Text strong>Багц № {record.pkgno || "Дугааргүй"}-ийн захиалгууд</Text>
                    <Tag color="blue">{record.items.length} захиалга</Tag>
                  </div>
                  <Space size={16} wrap>
                    <Text type="secondary">
                      {getServiceByShortName(record.dname)}{record.dname ? ` (${record.dname})` : ""}
                    </Text>
                    {record.year && record.month && (
                      <Text type="secondary">
                        {record.year} / {String(record.month).padStart(2, "0")}
                      </Text>
                    )}
                  </Space>
                </div>
                <Table
                  size="small"
                  sticky
                  pagination={{
                    defaultPageSize: 20,
                    pageSizeOptions: [20, 50, 100],
                    showSizeChanger: record.items.length > 20,
                    hideOnSinglePage: record.items.length <= 20,
                    showTotal: (total, range) => `${range[0]}–${range[1]} / ${total}`,
                  }}
                  scroll={{ x: 1120, y: 480 }}
                  columns={nestedColumns}
                  dataSource={record.items}
                  rowKey="reactKey"
                  locale={{ emptyText: <Empty description="Захиалга байхгүй" /> }}
                />
              </div>
            );
          },
        }}
        onRow={(record) => ({
          onClick: (event) => {
            if (event.target.closest("button, a, input, .ant-dropdown")) return;
            togglePackageDetails(record.key);
          },
          style: {
            cursor: "pointer",
            background: record.isLocked
              ? "#fff7f6"
              : selectedRowKeys.includes(record.key)
                ? "#f0f7ff"
                : undefined,
          },
        })}
        rowClassName={(record) => {
          const classes = ["package-root-row"];
          if (expandedPackageKeys.includes(record.key)) classes.push("package-root-row--expanded");
          if (record.isLocked) classes.push("package-root-row--locked");
          if (selectedRowKeys.includes(record.key)) classes.push("package-root-row--selected");
          return classes.join(" ");
        }}
        locale={{
          emptyText: (
            <Empty
              description={searchText ? "Хайлтад тохирох захиалга олдсонгүй" : "Захиалга байхгүй"}
            />
          ),
        }}
        size="middle"
      />

      <Modal
        title="Бараа материалын үлдэгдэл"
        open={inventoryVisible}
        onCancel={handleCloseInventory}
        footer={null}
        centered
        destroyOnHidden
        width={1000 + customColumnsCount * 150}
      >
        <InventoryReportForm
          record={selectedRecord}
          onClose={handleCloseInventory}
          onColumnsChange={setCustomColumnsCount}
        />
      </Modal>
    </>
  );
};

GroupedTable.propTypes = {
  data: PropTypes.array,
  onSelectRows: PropTypes.func,
  selectionResetToken: PropTypes.number,
  selectable: PropTypes.bool,
  showOwner: PropTypes.bool,
};

export default GroupedTable;
