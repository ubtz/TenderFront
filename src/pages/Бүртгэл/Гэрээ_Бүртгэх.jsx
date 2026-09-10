import { useCallback, useEffect, useMemo, useState } from "react";
import { DatePicker, Input, Segmented, Typography, message } from "antd";
import { FileDoneOutlined, SearchOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import GereeTable from "./GereeTable";
import GereeModal from "./GereeModal";
import { getStoredUser } from "../../api/session";
import "./Geree.css";

const { RangePicker } = DatePicker;
const { Text } = Typography;
const API_BASE_URL = import.meta.env.VITE_API_URL;

const normalize = (value) => String(value ?? "").trim();
const getContractDate = (record) => record?.["гэрээ_байгуулсан_огноо"] || record?.CreatedAt;

const Geree = () => {
  const user = useMemo(() => getStoredUser() || {}, []);
  const [gereenuud, setGereenuud] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [activeYear, setActiveYear] = useState("all");
  const [dateRange, setDateRange] = useState(null);

  const fetchGeree = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/get/GetGeree`);
      const allContracts = Array.isArray(response.data) ? response.data : [];
      const role = user?.erh || user?.Erh || "";
      const filtered = role === "Удирдлага"
        ? allContracts
        : allContracts.filter((contract) => Number(contract.GereeUserId) === Number(user.id));
      setGereenuud(filtered);
    } catch (error) {
      console.error("Contract fetch failed:", error);
      message.error("Гэрээний мэдээлэл татахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }, [user?.Erh, user?.erh, user.id]);

  useEffect(() => {
    fetchGeree();
  }, [fetchGeree]);

  const handleUpdate = async (id, field, value) => {
    try {
      await axios.put(`${API_BASE_URL}/put/UpdateGeree/${id}`, { field, value });
      setGereenuud((current) => current.map((contract) =>
        Number(contract.GereeId) === Number(id) ? { ...contract, [field]: value } : contract
      ));
      setSelectedRecord((current) =>
        Number(current?.GereeId) === Number(id) ? { ...current, [field]: value } : current
      );
      message.success("Өөрчлөлт хадгалагдлаа");
      return true;
    } catch (error) {
      console.error("Contract update failed:", error);
      message.error(error.response?.data?.error || "Шинэчлэхэд алдаа гарлаа");
      return false;
    }
  };

  const yearOptions = useMemo(() => {
    const years = new Set(["2025", "2026", "2027"]);
    gereenuud.forEach((record) => {
      const date = dayjs(getContractDate(record));
      if (date.isValid()) years.add(String(date.year()));
    });
    return [...years].sort((first, second) => second.localeCompare(first));
  }, [gereenuud]);

  const filteredContracts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("mn-MN");
    return gereenuud.filter((record) => {
      const contractDate = dayjs(getContractDate(record));
      if (activeYear !== "all" && (!contractDate.isValid() || String(contractDate.year()) !== activeYear)) {
        return false;
      }
      if (dateRange?.[0] && dateRange?.[1]) {
        if (
          !contractDate.isValid()
          || contractDate.isBefore(dateRange[0].startOf("day"))
          || contractDate.isAfter(dateRange[1].endOf("day"))
        ) {
          return false;
        }
      }
      if (!query) return true;
      return [
        record["гэрээний_дугаар"],
        record["бэлтгэн_нийлүүлэгч_ААН"],
        record["гэрээ_байгуулсан_ААН"],
        record["тендерийн_дугаар"],
        record.geree_user_name,
        record.created_by_user,
        record["ААН_регистер"],
      ].some((value) => normalize(value).toLocaleLowerCase("mn-MN").includes(query));
    });
  }, [activeYear, dateRange, gereenuud, search]);

  const visibleTotal = useMemo(
    () => filteredContracts.reduce((sum, record) => sum + Number(record["гэрээний_дүн"] || 0), 0),
    [filteredContracts]
  );

  return (
    <div className="geree-page">
      <section className="geree-toolbar">
        <div className="geree-toolbar__top">
          <div className="geree-toolbar__identity">
            <span className="geree-toolbar__icon"><FileDoneOutlined /></span>
            <div>
              <h1>Гэрээний бүртгэл</h1>
              <Text type="secondary">Нийт {gereenuud.length} гэрээ · Мөр дээр дарж ажлын талбарыг нээнэ</Text>
            </div>
          </div>
          <div className="geree-toolbar__controls">
            <RangePicker
              allowClear
              value={dateRange}
              onChange={setDateRange}
              placeholder={["Эхлэх огноо", "Дуусах огноо"]}
              format="YYYY/MM/DD"
            />
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Гэрээний нэр, ААН, тендерээр хайх"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="geree-toolbar__bottom">
          <Segmented
            value={activeYear}
            onChange={setActiveYear}
            options={[
              { label: "Бүх он", value: "all" },
              ...yearOptions.map((year) => ({ label: year, value: year })),
            ]}
          />
          <div className="geree-toolbar__summary">
            <span>Харагдаж буй <strong>{filteredContracts.length}</strong></span>
            <span>Нийт дүн <strong>{visibleTotal.toLocaleString()} ₮</strong></span>
          </div>
        </div>
      </section>

      <div className="geree-table-card">
        <GereeTable
          data={filteredContracts}
          loading={loading}
          onRowClick={(record) => {
            setSelectedRecord(record);
            setModalVisible(true);
          }}
        />
      </div>

      <GereeModal
        visible={modalVisible}
        record={selectedRecord}
        canReturn={Number(selectedRecord?.GereeUserId) === Number(user.id)}
        onClose={() => setModalVisible(false)}
        handleUpdate={handleUpdate}
        onReturned={(gereeId) => {
          setGereenuud((current) => current.filter(
            (contract) => Number(contract.GereeId) !== Number(gereeId)
          ));
          setSelectedRecord(null);
          setModalVisible(false);
        }}
      />
    </div>
  );
};

export default Geree;
