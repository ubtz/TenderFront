import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Typography, Row, Col, Card, Empty, Radio, Select, Segmented, Spin, message } from "antd";
import ReactECharts from "echarts-for-react";
import CountUp from "react-countup";
import { useNavigate } from "react-router-dom";
import {
  ArrowRightOutlined,
} from "@ant-design/icons";

import GovLogo from "../assets/Gov_Logo.png";
import GovLogoTender from "../assets/Gov_Tender_logo.png";
import GovLogoBank from "../assets/Gov_Bank_Logo.png";
import GovLogoLaw from "../assets/Gov_Law_logo.png";
import Gov_Ubtz_Logo from "../assets/Gov_Ubtz_Logo.jpg";
import "./Home.css";

const { Title, Text } = Typography;
const { Option } = Select;

const LOGOS = [
  { src: GovLogo, text: "САНГИЙН ЯАМ", url: "https://mof.gov.mn/" },
  { src: GovLogo, text: "ЗАМ, ТЭЭВРИЙН ЯАМ", url: "https://mrt.gov.mn/" },
  { src: GovLogo, text: "ХУУЛЬ ЗҮЙ, ДОТООД ХЭРГИЙН ЯАМ", url: "https://mojha.gov.mn/" },
  { src: GovLogoTender, text: "ТӨРИЙН ХУДАЛДАН АВАХ АЖИЛЛАГААНЫ СИСТЕМ", url: "https://tender.gov.mn/" },
  { src: GovLogoBank, text: "МОНГОЛБАНК", url: "https://www.mongolbank.mn/" },
  { src: GovLogoLaw, text: "ЭРХ ЗҮЙН МЭДЭЭЛЛИЙН НЭГДСЭН СИСТЕМ", url: "https://legalinfo.mn/" },
  { src: Gov_Ubtz_Logo, text: "УЛААНБААТАР ТӨМӨР ЗАМ", url: "https://ubtz.mn/" },
];

export default function Home() {
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_URL;

  const [scope, setScope] = useState("zam");
  const [selectedAAN, setSelectedAAN] = useState(null);
  const [activeYear, setActiveYear] = useState(String(new Date().getFullYear()));

  const [branchList, setBranchList] = useState([]);
  const [branchStats, setBranchStats] = useState([]);
  const [statisticData, setStatisticData] = useState([]);
  const [statisticSummary, setStatisticSummary] = useState({
    Dcode: "",
    TotalOrders: 0,
    TotalOrderValue: 0,
    TotalTenders: 0,
    TotalBudget: 0,
    SuccessfulTenders: 0,
    SuccessfulBudget: 0,
    SuspendedTenders: 0,
    TotalContracts: 0,
    TotalContractValue: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [branchesRes, branchStatsRes, statisticRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/get/branches`),
          axios.get(`${API_BASE_URL}/get/GetBranchStatistics`),
          axios.get(`${API_BASE_URL}/get/Statistic`, { params: { year: activeYear } }),
        ]);

        setBranchList(Array.isArray(branchesRes.data) ? branchesRes.data : []);
        setBranchStats(Array.isArray(branchStatsRes.data) ? branchStatsRes.data : []);

        const statisticPayload = statisticRes.data || {};
        setStatisticData(Array.isArray(statisticPayload.rows) ? statisticPayload.rows : []);
        setStatisticSummary(statisticPayload.summary || {
          Dcode: "",
          TotalOrders: 0,
          TotalOrderValue: 0,
          TotalTenders: 0,
          TotalBudget: 0,
          SuccessfulTenders: 0,
          SuccessfulBudget: 0,
          SuspendedTenders: 0,
          TotalContracts: 0,
          TotalContractValue: 0,
        });
      } catch (err) {
        console.error("❌ Failed to fetch dashboard data:", err);
        message.error("Мэдээлэл татаж чадсангүй!");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [API_BASE_URL, activeYear]);

  useEffect(() => {
    setSelectedAAN(null);
  }, [scope]);

  const uniqueServices = useMemo(() => {
    return [...new Set(branchList.map((b) => b.service).filter(Boolean))];
  }, [branchList]);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [...new Set([
      currentYear - 1,
      currentYear,
      currentYear + 1,
      ...branchStats.map((item) => Number(item.year)).filter(Boolean),
    ])].sort((first, second) => first - second);
  }, [branchStats]);

  const selectedServiceBranchIds = useMemo(() => {
    if (scope !== "alban" || !selectedAAN) return new Set();

    return new Set(
      branchList
        .filter((b) => String(b.service) === String(selectedAAN))
        .map((b) => String(b.id))
    );
  }, [branchList, scope, selectedAAN]);

  const filteredBranchStats = useMemo(() => {
    const yearStats = branchStats.filter((item) => String(item.year) === activeYear);
    if (scope === "zam") return yearStats;

    if (scope === "alban") {
      if (!selectedServiceBranchIds.size) return [];
      return yearStats.filter((item) =>
        selectedServiceBranchIds.has(String(item.branchId))
      );
    }

    if (!selectedAAN) return [];
    return yearStats.filter(
      (item) => String(item.branchId) === String(selectedAAN)
    );
  }, [activeYear, branchStats, scope, selectedAAN, selectedServiceBranchIds]);

  const filteredStatisticData = useMemo(() => {
    if (scope === "zam") return statisticData;

    if (scope === "alban") {
      if (!selectedServiceBranchIds.size) return [];
      return statisticData.filter((item) =>
        selectedServiceBranchIds.has(String(item.dcode))
      );
    }

    if (!selectedAAN) return [];
    return statisticData.filter((item) => String(item.dcode) === String(selectedAAN));
  }, [statisticData, scope, selectedAAN, selectedServiceBranchIds]);

  const displayStats = useMemo(() => {
    if (scope === "zam") {
      return statisticSummary;
    }

    return filteredStatisticData.reduce(
      (acc, item) => {
        acc.TotalOrders += Number(item.TotalOrders) || 0;
        acc.TotalOrderValue += Number(item.TotalOrderValue) || 0;
        acc.TotalTenders += Number(item.TotalTenders) || 0;
        acc.TotalBudget += Number(item.TotalBudget) || 0;
        acc.SuccessfulTenders += Number(item.SuccessfulTenders) || 0;
        acc.SuccessfulBudget += Number(item.SuccessfulBudget) || 0;
        acc.SuspendedTenders += Number(item.SuspendedTenders) || 0;

        acc.TotalContracts += Number(item.TotalContracts) || 0;
        acc.TotalContractValue += Number(item.TotalContractValue) || 0;

        return acc;
      },
      {
        Dcode: "",
        TotalOrders: 0,
        TotalOrderValue: 0,
        TotalTenders: 0,
        TotalBudget: 0,
        SuccessfulTenders: 0,
        SuccessfulBudget: 0,
        SuspendedTenders: 0,
        TotalContracts: 0,
        TotalContractValue: 0,
      }
    );
  }, [scope, statisticSummary, filteredStatisticData]);

  const branchSummary = useMemo(() => {
    return filteredBranchStats.reduce(
      (acc, item) => {
        acc.orders += Number(item.orders) || 0;
        acc.qty += Number(item.qty) || 0;
        acc.amount += Number(item.amount) || 0;
        return acc;
      },
      { orders: 0, qty: 0, amount: 0 }
    );
  }, [filteredBranchStats]);

  const pieSummary = useMemo(() => {
    if (scope === "zam") {
      return {
        orders: Number(statisticSummary.TotalOrders) || 0,
        tenders: Number(statisticSummary.TotalTenders) || 0,
        contracts: Number(statisticSummary.TotalContracts) || 0,
      };
    }

    if (!filteredStatisticData.length) {
      return { orders: 0, tenders: 0, contracts: 0 };
    }

    return filteredStatisticData.reduce(
      (acc, item) => {
        acc.orders += Number(item.TotalOrders) || 0;
        acc.tenders += Number(item.TotalTenders) || 0;

        acc.contracts += Number(item.TotalContracts) || 0;

        return acc;
      },
      { orders: 0, tenders: 0, contracts: 0 }
    );
  }, [scope, statisticSummary, filteredStatisticData]);

  const pieData = useMemo(() => {
    if (scope === "zam") {
      return [
        { name: "Захиалга", value: pieSummary.orders, color: "#3b82f6" },
        { name: "Тендер", value: pieSummary.tenders, color: "#10b981" },
        { name: "Гэрээ", value: pieSummary.contracts, color: "#f59e0b" },
      ].filter((item) => item.value > 0);
    }

    if (scope === "alban" && !selectedAAN) return [];
    if (scope === "aan" && !selectedAAN) return [];

    return [
      { name: "Захиалга", value: pieSummary.orders, color: "#3b82f6" },
      { name: "Тендер", value: pieSummary.tenders, color: "#10b981" },
      { name: "Гэрээ", value: pieSummary.contracts, color: "#f59e0b" },
    ].filter((item) => item.value > 0);
  }, [pieSummary, scope, selectedAAN]);

  const chartOption = useMemo(() => {
    const total = pieData.reduce((sum, item) => sum + item.value, 0);

    return {
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} ({d}%)",
      },
      graphic: [
        {
          type: "text",
          left: "center",
          top: "middle",
          style: {
            text: `${total.toLocaleString()}\nНийт бүртгэл`,
            textAlign: "center",
            fill: "#0f172a",
            fontSize: 16,
            fontWeight: 600,
          },
        },
      ],
      series: [
        {
          type: "pie",
          radius: "70%",
          center: ["50%", "42%"],
          label: {
            show: true,
            position: "outside",
            fontSize: 14,
            fontWeight: 500,
            color: "#334155",
            formatter: (params) => {
              return `${params.name}: ${params.value.toLocaleString()}`;
            },
          },
          labelLine: { length: 15, length2: 20, smooth: true },
          itemStyle: {
            borderRadius: 8,
            borderColor: "#fff",
            borderWidth: 2,
            shadowBlur: 8,
            shadowColor: "rgba(0,0,0,0.08)",
          },
          data: pieData.map((d) => ({
            value: d.value,
            name: d.name,
            itemStyle: { color: d.color },
          })),
          animationType: "scale",
          animationEasing: "elasticOut",
          animationDelay: (idx) => idx * 150,
        },
      ],
    };
  }, [pieData]);

  if (loading) {
    return <Spin fullscreen size="large" tip="Түр хүлээнэ үү..." />;
  }

  return (
    <div
      className="home-container home-energetic"
      style={{
        padding: "24px 16px",
        background: "linear-gradient(180deg, #f9fafb 0%, #eef2f7 100%)",
        minHeight: "100vh",
      }}
    >
      <div className="home-year-toolbar">
        <div className="home-year-selector">
          <Segmented
            value={activeYear}
            onChange={setActiveYear}
            options={availableYears.map((year) => ({ label: `${year} он`, value: String(year) }))}
          />
        </div>
      </div>
      {/* <Card
        style={{
          marginBottom: 24,
          textAlign: "center",
          borderRadius: 14,
          background: "linear-gradient(135deg, #ffffff, #f8fafc)",
          boxShadow: "0 3px 12px rgba(0,0,0,0.04)",
          padding: "10px 0",
          height: 90,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 15, color: "#475569", fontWeight: 500 }}>
          НИЙТ ТЕНДЕРИЙН МӨНГӨН ДҮН
        </Text>
        <Title
          level={3}
          style={{
            color: "#0f172a",
            marginTop: 4,
            marginBottom: 0,
            fontWeight: 700,
            lineHeight: 1,
            fontSize: 24,
          }}
        >
          <CountUp end={stats?.TotalBudget || 0} duration={2} separator="," />
        </Title>
      </Card> */}

      <Row gutter={32} className="home-main-grid">
        <Col xs={24} md={16}>
          <Card
            className="home-chart-card"
            title={
              <div className="home-chart-title">
                <Text strong>Тоон мэдээлэл</Text>
                <Text type="secondary">{activeYear} оны сонгосон хамрах хүрээний харьцуулалт</Text>
              </div>
            }
            style={{
              borderRadius: 20,
              boxShadow: "0 4px 25px rgba(0,0,0,0.08)",
              background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
              overflow: "hidden",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div className="home-control-label">Хамрах хүрээ сонгох</div>
              <Radio.Group
                className="home-scope-switch"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                buttonStyle="solid"
                style={{
                  background: "#f1f5f9",
                  borderRadius: 12,
                  padding: 6,
                  boxShadow: "inset 0 1px 4px rgba(0,0,0,0.05)",
                }}
              >
                <Radio.Button value="zam">Замын хэмжээнд</Radio.Button>
                <Radio.Button value="alban">Албаны хэмжээнд</Radio.Button>
                <Radio.Button value="aan">ААН хэмжээнд</Radio.Button>
              </Radio.Group>
            </div>

            {scope !== "zam" && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: 24,
                }}
              >
                <Select
                  style={{ width: 320 }}
                  placeholder={scope === "alban" ? "Алба сонгох" : "ААН сонгох"}
                  value={selectedAAN}
                  onChange={setSelectedAAN}
                  showSearch
                  allowClear
                  optionFilterProp="children"
                >
                  {(scope === "alban" ? uniqueServices : branchList).map((b) => (
                    <Option key={b.id || b} value={b.id || b}>
                      {typeof b === "string"
                        ? b
                        : `${b.shortName || b.id} — ${b.branch || ""}`}
                    </Option>
                  ))}
                </Select>
              </div>
            )}

            <div
              className="home-chart-surface"
              style={{
                background: "radial-gradient(circle at center, #f9fafb 0%, #f1f5f9 100%)",
                borderRadius: 20,
                padding: "40px 20px 30px",
                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.05)",
                textAlign: "center",
                transition: "all 0.3s ease",
              }}
            >
              {pieData.length ? (
                <ReactECharts option={chartOption} style={{ height: 380 }} />
              ) : (
                <div className="home-chart-empty">
                  <Empty description={scope === "zam" || selectedAAN ? `${activeYear} онд мэдээлэл алга` : "Алба эсвэл ААН сонгоно уу"} />
                </div>
              )}

              <div
                style={{
                  marginTop: 24,
                  display: "flex",
                  justifyContent: "space-evenly",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                {pieData.map((item) => (
                  <div
                    className="home-chart-chip"
                    key={item.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "rgba(255,255,255,0.7)",
                      borderRadius: 10,
                      padding: "6px 10px",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: item.color,
                      }}
                    />
                    <span style={{ fontWeight: 500, color: "#0f172a" }}>{item.name}</span>
                    <span style={{ color: "#475569" }}>
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {(scope === "zam" || selectedAAN) && (
                <div className="home-branch-summary">
                  <div><span>Захиалгын тоо</span><strong>{branchSummary.orders.toLocaleString()}</strong></div>
                  <div><span>Нийт тоо хэмжээ</span><strong>{branchSummary.qty.toLocaleString()}</strong></div>
                  <div><span>Нийт мөнгөн дүн</span><strong>{branchSummary.amount.toLocaleString()} ₮</strong></div>
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} md={8} className="home-stat-column">
          {displayStats ? (
            <>
              <Card
                className="home-stat-card home-stat-card--green"
                style={{
                  background: "linear-gradient(135deg, #10b98115, #10b98125)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 20,
                  color: "#0f172a",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                  marginBottom: 20,
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                }}
                onClick={() =>
                  navigate("/Явц1", {
                    state: { activeStepKey: "request" },
                  })
                }
                hoverable
                styles={{ body: { padding: "22px 26px" } }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.08)";
                }}
              >
                <div className="home-stat-card__header">
                  <Title level={4} style={{ color: "#0f172a", marginBottom: 10 }}>Нийт тендерийн захиалга</Title>
                </div>
                <div className="home-stat-metrics">
                  <div><span>Захиалгын тоо</span><strong>{displayStats.TotalOrders.toLocaleString()}</strong></div>
                  <div><span>Нийт мөнгөн дүн</span><Text strong style={{ color: "#10b981" }}><CountUp end={displayStats.TotalOrderValue} duration={2} separator="," /> ₮</Text></div>
                </div>
                <div className="home-stat-action">Дэлгэрэнгүй харах <ArrowRightOutlined /></div>
              </Card>

              <Card
                className="home-stat-card home-stat-card--rose"
                style={{
                  background: "linear-gradient(135deg, #f43f5e15, #f43f5e25)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 20,
                  color: "#0f172a",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                  marginBottom: 20,
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                }}
                onClick={() =>
                  navigate("/Явц1", {
                    state: { activeStepKey: "tender" },
                  })
                }
                hoverable
                styles={{ body: { padding: "22px 26px" } }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.08)";
                }}
              >
                <div className="home-stat-card__header">
                  <Title level={4} style={{ color: "#0f172a", marginBottom: 10 }}>Нийт зарлагдсан тендер</Title>
                </div>
                <div className="home-stat-metrics">
                  <div><span>Тендерийн тоо</span><strong>{displayStats.TotalTenders.toLocaleString()}</strong></div>
                  <div><span>Батлагдсан төсөв</span><Text strong style={{ color: "#f43f5e" }}><CountUp end={displayStats.TotalBudget} duration={2} separator="," /> ₮</Text></div>
                </div>
                <div className="home-stat-action">Дэлгэрэнгүй харах <ArrowRightOutlined /></div>
              </Card>

              <Card
                className="home-stat-card home-stat-card--blue"
                style={{
                  background: "linear-gradient(135deg, #3b82f615, #3b82f625)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 20,
                  color: "#0f172a",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                  marginBottom: 20,
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                }}
                onClick={() =>
                  navigate("/Явц1", {
                    state: { activeStepKey: "contract" },
                  })
                }
                hoverable
                styles={{ body: { padding: "22px 26px" } }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.08)";
                }}
              >
                <div className="home-stat-card__header">
                  <Title level={4} style={{ color: "#0f172a", marginBottom: 10 }}>Байгуулсан гэрээ</Title>
                </div>
                <div className="home-stat-metrics">
                  <div><span>Гэрээний тоо</span><strong>{displayStats.TotalContracts.toLocaleString()}</strong></div>
                  <div><span>Гэрээний нийт дүн</span><Text strong style={{ color: "#3b82f6" }}><CountUp end={displayStats.TotalContractValue} duration={2} separator="," /> ₮</Text></div>
                </div>
                <div className="home-stat-action">Дэлгэрэнгүй харах <ArrowRightOutlined /></div>
              </Card>
            </>
          ) : (
            <Text type="secondary">Мэдээлэл олдсонгүй.</Text>
          )}
        </Col>
      </Row>

      <div
        className="home-links-section"
        style={{
          marginTop: 50,
          padding: "30px 0",
          background: "linear-gradient(135deg, #f8fafc, #eef2f7)",
          borderRadius: 20,
        }}
      >
        <Row gutter={[16, 16]} justify="center">
          {LOGOS.map((logo) => (
            <Col key={logo.url} xs={12} sm={8} md={6} lg={3}>
              <a href={logo.url} target="_blank" rel="noopener noreferrer">
                <Card
                  className="home-link-card"
                  hoverable
                  styles={{ body: { padding: 0 } }}
                  style={{
                    textAlign: "center",
                    borderRadius: 14,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    transition: "all 0.25s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: 10,
                    }}
                  >
                    <img
                      className="home-link-logo"
                      src={logo.src}
                      alt={logo.text}
                      style={{
                        width: 55,
                        height: 55,
                        borderRadius: "50%",
                        border: "1px solid #e2e8f0",
                        padding: 6,
                        background: "#fff",
                        objectFit: "cover",
                        transition: "all 0.3s ease",
                      }}
                    />
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#334155",
                        textAlign: "center",
                        lineHeight: 1.3,
                      }}
                    >
                      {logo.text}
                    </div>
                  </div>
                </Card>
              </a>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
}
