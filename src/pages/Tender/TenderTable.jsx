import { Progress, Table, Tag, Typography } from "antd";
import { CheckCircleOutlined, FileTextOutlined } from "@ant-design/icons";
import { calcCompletion } from "./tender.utils";

const { Text } = Typography;

const getCompletionMode = (record) =>
  ["НТШ", "ХА"].includes(record?.тендерийн_төрөл?.trim()) ? "default" : "zuk";

const TenderTable = ({ data, loading, onRowClick, contractTenderIds }) => {
  const columns = [
    {
      title: "Тендер",
      key: "tender",
      minWidth: 280,
      render: (_, record) => (
        <div>
          <Text strong style={{ color: "#24445f" }}>
            {record.тендерийн_дугаар || "Дугааргүй"}
          </Text>
          <div style={{ marginTop: 3, color: "#64768a" }}>
            {record.tender_name || "Нэр оруулаагүй"}
          </div>
        </div>
      ),
      sorter: (a, b) =>
        String(a.тендерийн_дугаар || "").localeCompare(String(b.тендерийн_дугаар || "")),
    },
    {
      title: "Төрөл",
      dataIndex: "тендерийн_төрөл",
      width: 190,
      render: (value) => <Tag color="blue">{value || "Тодорхойгүй"}</Tag>,
      filters: [...new Set(data.map((item) => item.тендерийн_төрөл).filter(Boolean))].map(
        (value) => ({ text: value, value })
      ),
      onFilter: (value, record) => record.тендерийн_төрөл === value,
    },
    {
      title: "Хариуцсан ажилтан",
      key: "owner",
      width: 190,
      render: (_, record) =>
        `${record.Ovog || ""} ${record.Ner || ""}`.trim() || "—",
    },
    {
      title: "Төсөвт өртөг",
      dataIndex: "батлагдсан_төсөвт_өртөг",
      width: 160,
      align: "right",
      render: (value) => `${Number(value || 0).toLocaleString()} ₮`,
      sorter: (a, b) =>
        Number(a.батлагдсан_төсөвт_өртөг || 0) - Number(b.батлагдсан_төсөвт_өртөг || 0),
    },
    {
      title: "Явц",
      key: "progress",
      width: 190,
      render: (_, record) => {
        const percent = calcCompletion(record, getCompletionMode(record));
        return <Progress percent={percent} size="small" strokeColor="#4f7f9d" />;
      },
      sorter: (a, b) =>
        calcCompletion(a, getCompletionMode(a)) - calcCompletion(b, getCompletionMode(b)),
    },
    {
      title: "Гэрээ",
      key: "contract",
      width: 130,
      align: "center",
      render: (_, record) =>
        contractTenderIds.has(Number(record.tender_id)) ? (
          <Tag icon={<CheckCircleOutlined />} color="success">Үүссэн</Tag>
        ) : (
          <Tag icon={<FileTextOutlined />}>Үүсээгүй</Tag>
        ),
    },
  ];

  return (
    <Table
      rowKey="tender_id"
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (total) => `Нийт ${total}` }}
      scroll={{ x: 1120 }}
      locale={{ emptyText: "Тохирох тендер олдсонгүй" }}
      onRow={(record) => ({
        onClick: () => onRowClick(record),
        style: { cursor: "pointer" },
      })}
    />
  );
};

export default TenderTable;
