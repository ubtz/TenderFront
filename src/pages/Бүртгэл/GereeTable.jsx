import { Progress, Table, Tag, Typography } from "antd";
import { FileDoneOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { calcCompletion } from "./GereeFieldRenderers";

const { Text } = Typography;
const formatDateTime = (value) => dayjs(value).isValid() ? dayjs(value).format("YYYY.MM.DD HH:mm") : "—";
const getCreatorName = (record) => record.created_by_user || record.geree_user_name || "Тодорхойгүй";

const GereeTable = ({ data, loading, onRowClick }) => {
  const columns = [
    {
      title: "Гэрээ",
      key: "contract",
      width: 235,
      render: (_, record) => (
        <div className="geree-table__identity">
          <span className="geree-table__document"><FileDoneOutlined /></span>
          <div>
            <Text strong>{record["гэрээний_дугаар"] || "Нэр өгөөгүй гэрээ"}</Text>
            <div className="geree-table__created-meta">
              <Text type="secondary">Үүсгэсэн: {getCreatorName(record)}</Text>
              <Text type="secondary">{formatDateTime(record.CreatedAt)}</Text>
            </div>
          </div>
        </div>
      ),
      sorter: (first, second) => String(first["гэрээний_дугаар"] || "")
        .localeCompare(String(second["гэрээний_дугаар"] || "")),
    },
    {
      title: "Бэлтгэн нийлүүлэгч",
      dataIndex: "бэлтгэн_нийлүүлэгч_ААН",
      width: 240,
      ellipsis: true,
      render: (value, record) => (
        <div className="geree-table__stack">
          <Text>{value || "Тодорхойгүй"}</Text>
          {record["ААН_регистер"] && <Text type="secondary">РД: {record["ААН_регистер"]}</Text>}
        </div>
      ),
    },
    {
      title: "Худалдан авагч",
      dataIndex: "гэрээ_байгуулсан_ААН",
      width: 210,
      ellipsis: true,
      render: (value) => value || "—",
    },
    {
      title: "Гэрээний дүн",
      dataIndex: "гэрээний_дүн",
      width: 165,
      align: "right",
      sorter: (first, second) => Number(first["гэрээний_дүн"] || 0) - Number(second["гэрээний_дүн"] || 0),
      render: (value, record) => (
        <Text strong className="geree-table__amount">
          {Number(value || 0).toLocaleString()} {record["валют"] || "₮"}
        </Text>
      ),
    },
    {
      title: "Огноо",
      dataIndex: "гэрээ_байгуулсан_огноо",
      width: 120,
      render: (value) => dayjs(value).isValid() ? dayjs(value).format("YYYY.MM.DD") : "—",
      sorter: (first, second) => dayjs(first["гэрээ_байгуулсан_огноо"]).valueOf()
        - dayjs(second["гэрээ_байгуулсан_огноо"]).valueOf(),
    },
    {
      title: "Төлөв",
      dataIndex: "гэрээний_төлөв",
      width: 125,
      align: "center",
      render: (value) => <Tag color={value === "Дууссан" ? "default" : "success"}>{value || "Идэвхтэй"}</Tag>,
    },
    {
      title: "Явц",
      key: "progress",
      width: 180,
      sorter: (first, second) => calcCompletion(first) - calcCompletion(second),
      render: (_, record) => (
        <Progress percent={calcCompletion(record)} size="small" strokeColor="#4f7f9d" />
      ),
    },
  ];

  return (
    <Table
      rowKey="GereeId"
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (total) => `Нийт ${total}` }}
      scroll={{ x: 1275 }}
      locale={{ emptyText: "Тохирох гэрээ олдсонгүй" }}
      onRow={(record) => ({
        onClick: () => onRowClick(record),
        className: "geree-table__row",
      })}
    />
  );
};

export default GereeTable;
