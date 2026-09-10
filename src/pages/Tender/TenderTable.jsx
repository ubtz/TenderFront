import { Progress, Table, Tag, Tooltip, Typography } from "antd";
import { CheckCircleOutlined, FileTextOutlined, RollbackOutlined } from "@ant-design/icons";
import PropTypes from "prop-types";
import { calcCompletion } from "./tender.utils";
import { formatBudgetAmount } from "./tender.money";

const { Text } = Typography;

const getCompletionMode = (record) =>
  ["НТШ", "ХА"].includes(record?.тендерийн_төрөл?.trim()) ? "default" : "zuk";

const TenderTable = ({ data, loading, onRowClick, contractTenderIds, contractsByTenderId }) => {
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
      render: (value) => `${formatBudgetAmount(value || 0)} ₮`,
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
      width: 230,
      align: "center",
      render: (_, record) => {
        const tenderId = Number(record.tender_id);
        if (!contractTenderIds.has(tenderId)) {
          if (record.has_returned_contract) {
            const returnComment = String(record.returned_contract_comment || "").trim();
            return (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <Tag icon={<RollbackOutlined />} color="warning">Гэрээнээс буцаасан</Tag>
                {record.returned_contract_by && (
                  <Text type="secondary" style={{ fontSize: 12 }}>{record.returned_contract_by}</Text>
                )}
                {returnComment && (
                  <Tooltip title={returnComment}>
                    <Text ellipsis style={{ width: 190, fontSize: 12, color: "#9a5b32" }}>
                      {returnComment}
                    </Text>
                  </Tooltip>
                )}
              </div>
            );
          }
          return <Tag icon={<FileTextOutlined />}>Үүсээгүй</Tag>;
        }

        const specialistName = String(
          contractsByTenderId.get(tenderId)?.geree_user_name || ""
        ).trim();
        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <Tag icon={<CheckCircleOutlined />} color="success">Үүссэн</Tag>
            {specialistName && (
              <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.25 }}>
                {specialistName}
              </Text>
            )}
          </div>
        );
      },
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

TenderTable.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  onRowClick: PropTypes.func.isRequired,
  contractTenderIds: PropTypes.instanceOf(Set).isRequired,
  contractsByTenderId: PropTypes.instanceOf(Map).isRequired,
};

export default TenderTable;
