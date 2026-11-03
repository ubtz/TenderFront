import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, DatePicker, Input, Segmented, message } from "antd";
import { ClockCircleOutlined, PauseCircleOutlined, SearchOutlined, UnorderedListOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import { getStoredUser } from "../../api/session";
import TenderTable from "./TenderTable";
import TenderModal from "./TenderModal";
import TenderSuspendModal from "./TenderSuspendModal";
import "./Tender.css";

const isSuspended = (tender) =>
  !String(tender?.түтгэлзүүлсэн_огноо || "").startsWith("1900");
const isWaitingExternal = (tender) => tender?.lifecycle_status === "WaitingExternal";
const { RangePicker } = DatePicker;
const tenderYears = ["2025", "2026", "2027"];

const Tender = () => {
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const user = getStoredUser() || {};
  const [tenders, setTenders] = useState([]);
  const [contractTenderIds, setContractTenderIds] = useState(new Set());
  const [contractsByTenderId, setContractsByTenderId] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState("normal");
  const [activeYear, setActiveYear] = useState("all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState(null);
  const [selectedTender, setSelectedTender] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [suspendVisible, setSuspendVisible] = useState(false);
  const [suspendDate, setSuspendDate] = useState(null);

  const fetchTenders = useCallback(async () => {
    try {
      setLoading(true);
      const [tenderResult, contractResult] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/get/GetTender`),
        axios.get(`${API_BASE_URL}/get/GetGeree`),
      ]);

      if (tenderResult.status === "rejected") throw tenderResult.reason;

      const allTenders = Array.isArray(tenderResult.value.data)
        ? tenderResult.value.data
        : [];
      const accessibleTenders =
        user?.erh === "Удирдлага"
          ? allTenders
          : allTenders.filter((tender) => Number(tender.created_by) === Number(user.id));

      setTenders(accessibleTenders);

      if (contractResult.status === "fulfilled") {
        const contracts = Array.isArray(contractResult.value.data) ? contractResult.value.data : [];
        const groupedContracts = new Map();
        contracts.forEach((contract) => {
          const tenderId = Number(contract.TenderId);
          if (!groupedContracts.has(tenderId)) groupedContracts.set(tenderId, []);
          groupedContracts.get(tenderId).push(contract);
        });
        setContractTenderIds(
          new Set(groupedContracts.keys())
        );
        setContractsByTenderId(groupedContracts);
      }
    } catch (error) {
      console.error("Tender fetch failed:", error);
      message.error(error?.response?.data?.error || "Тендер татахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, user?.erh, user.id]);

  useEffect(() => {
    fetchTenders();
  }, [fetchTenders]);

  const counts = useMemo(
    () => ({
      normal: tenders.filter((tender) => !isWaitingExternal(tender) && !isSuspended(tender)).length,
      suspended: tenders.filter((tender) => !isWaitingExternal(tender) && isSuspended(tender)).length,
      waiting: tenders.filter(isWaitingExternal).length,
    }),
    [tenders]
  );

  const filteredTenders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("mn-MN");
    return tenders.filter((tender) => {
      const matchesStatus = filterType === "waiting"
        ? isWaitingExternal(tender)
        : filterType === "suspended"
          ? !isWaitingExternal(tender) && isSuspended(tender)
          : !isWaitingExternal(tender) && !isSuspended(tender);
      if (!matchesStatus) return false;
      const rawDate = tender.тендер_нээх_огноо || tender.created_at;
      const tenderDate = dayjs(rawDate);
      if (activeYear !== "all" && (!tenderDate.isValid() || String(tenderDate.year()) !== activeYear)) {
        return false;
      }
      if (dateRange?.[0] && dateRange?.[1]) {
        if (
          !tenderDate.isValid() ||
          tenderDate.isBefore(dateRange[0].startOf("day")) ||
          tenderDate.isAfter(dateRange[1].endOf("day"))
        ) {
          return false;
        }
      }
      if (!query) return true;
      return [
        tender.тендерийн_дугаар,
        tender.tender_name,
        tender.тендерийн_төрөл,
        tender.Organization,
        tender.Ovog,
        tender.Ner,
        tender.returned_contract_comment,
        tender.returned_contract_by,
      ].some((value) => String(value || "").toLocaleLowerCase("mn-MN").includes(query));
    });
  }, [activeYear, dateRange, filterType, search, tenders]);

  const handleUpdate = async (id, field, value) => {
    try {
      await axios.put(`${API_BASE_URL}/put/UpdateTender/${id}`, { field, value });
      setTenders((current) =>
        current.map((tender) =>
          tender.tender_id === id ? { ...tender, [field]: value } : tender
        )
      );
      setSelectedTender((current) =>
        current?.tender_id === id ? { ...current, [field]: value } : current
      );
      message.success("Амжилттай хадгаллаа");
      return true;
    } catch (error) {
      console.error("Tender update failed:", error);
      message.error(error?.response?.data?.error || "Шинэчлэхэд алдаа гарлаа");
      return false;
    }
  };

  const openSuspendModal = (tender) => {
    setSelectedTender(tender);
    setSuspendDate(null);
    setSuspendVisible(true);
  };

  const handleSuspend = async () => {
    if (!suspendDate || !selectedTender) {
      message.warning("Түдгэлзүүлэх огноо сонгоно уу");
      return;
    }
    const saved = await handleUpdate(
      selectedTender.tender_id,
      "түтгэлзүүлсэн_огноо",
      suspendDate.format("YYYY-MM-DD HH:mm:ss")
    );
    if (saved) {
      setSuspendVisible(false);
      setModalVisible(false);
      setSuspendDate(null);
      setFilterType("suspended");
    }
  };

  const handleActivate = async (tender) => {
    const saved = await handleUpdate(
      tender.tender_id,
      "түтгэлзүүлсэн_огноо",
      "1900-01-01T00:00:00Z"
    );
    if (saved) {
      setModalVisible(false);
      setFilterType("normal");
    }
  };

  const handleDelete = async (tender) => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/delete/Tender/${tender.tender_id}`);
      setTenders((current) => current.filter((item) => item.tender_id !== tender.tender_id));
      setSelectedTender(null);
      setModalVisible(false);
      message.success(response.data?.message || "Тендер амжилттай устгагдлаа");
      return true;
    } catch (error) {
      console.error("Tender delete failed:", error);
      message.error(error?.response?.data?.error || "Тендер устгахад алдаа гарлаа");
      throw error;
    }
  };

  const handleResetReannouncement = async (tender) => {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/delete/TenderReannouncement/${tender.tender_id}`
      );
      setSelectedTender(null);
      setModalVisible(false);
      setFilterType("normal");
      await fetchTenders();
      message.success(
        response.data?.message || "Хүлээгдэж буй дахин зарлалт цэвэрлэгдлээ"
      );
      return true;
    } catch (error) {
      console.error("Tender reannouncement reset failed:", error);
      message.error(
        error?.response?.data?.error || "Дахин зарлалтын хүлээлтийг цэвэрлэхэд алдаа гарлаа"
      );
      throw error;
    }
  };

  return (
    <div className="tender-page">
      <section className="tender-toolbar">
        <div className="tender-toolbar-top">
          <div>
            <h1 className="tender-title">Тендерийн бүртгэл</h1>
            <div className="tender-subtitle">
              Нийт {tenders.length} тендер · Мөр дээр дарж дэлгэрэнгүй мэдээллийг нээнэ
            </div>
          </div>
          <div className="tender-filter-controls">
            <RangePicker
              allowClear
              value={dateRange}
              onChange={setDateRange}
              placeholder={["Эхлэх огноо", "Дуусах огноо"]}
              format="YYYY/MM/DD"
            />
            <Input
              allowClear
              className="tender-search"
              prefix={<SearchOutlined />}
              placeholder="Дугаар, нэр, төрөл, байгууллагаар хайх"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="tender-toolbar-actions">
          <div className="tender-toolbar-filter-groups">
            <Segmented
              value={filterType}
              onChange={setFilterType}
              options={[
                {
                  value: "normal",
                  label: <span><UnorderedListOutlined /> Идэвхтэй <Badge count={counts.normal} showZero color="#4f7f9d" /></span>,
                },
                {
                  value: "suspended",
                  label: <span><PauseCircleOutlined /> Түдгэлзүүлсэн <Badge count={counts.suspended} showZero color="#ad7854" /></span>,
                },
                {
                  value: "waiting",
                  label: <span><ClockCircleOutlined /> Дахин зарласан · Хүлээгдэж буй <Badge count={counts.waiting} showZero color="#b17a2d" /></span>,
                },
              ]}
            />
            <Segmented
              value={activeYear}
              onChange={setActiveYear}
              options={[
                { label: "Бүх он", value: "all" },
                ...tenderYears.map((year) => ({ label: year, value: year })),
              ]}
            />
          </div>
          <span className="tender-subtitle">Харагдаж буй: {filteredTenders.length}</span>
        </div>
      </section>

      <div className="tender-table-card">
        <TenderTable
          data={filteredTenders}
          loading={loading}
          contractTenderIds={contractTenderIds}
          contractsByTenderId={contractsByTenderId}
          onRowClick={(record) => {
            setSelectedTender(record);
            setModalVisible(true);
          }}
        />
      </div>

      <TenderModal
        visible={modalVisible}
        record={selectedTender}
        user={user}
        hasContract={contractTenderIds.has(Number(selectedTender?.tender_id))}
        existingContracts={contractsByTenderId.get(Number(selectedTender?.tender_id)) || []}
        onContractCreated={(tenderId) => {
          setContractTenderIds((current) => new Set([...current, Number(tenderId)]));
          fetchTenders();
        }}
        onSuspend={openSuspendModal}
        onActivate={handleActivate}
        onDelete={handleDelete}
        onResetReannouncement={handleResetReannouncement}
        onReannounced={async (tenderId, result) => {
          if (result?.archived) {
            setSelectedTender(null);
            setModalVisible(false);
            setFilterType("waiting");
          }
          await fetchTenders();
        }}
        onClose={() => setModalVisible(false)}
        handleUpdate={handleUpdate}
      />

      <TenderSuspendModal
        visible={suspendVisible}
        date={suspendDate}
        onDateChange={setSuspendDate}
        onOk={handleSuspend}
        onCancel={() => {
          setSuspendVisible(false);
          setSuspendDate(null);
        }}
      />
    </div>
  );
};

export default Tender;
