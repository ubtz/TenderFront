import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Typography,
  Row,
  Col,
  Card,
  Radio,
  Select,
  Spin,
  message,
} from "antd";
import ReactECharts from "echarts-for-react";
import CountUp from "react-countup";
import {
  BarChartOutlined,
  RiseOutlined,
  DollarCircleOutlined,
} from "@ant-design/icons";

import GovLogo from "../assets/Gov_Logo.png";
import GovLogoTender from "../assets/Gov_Tender_logo.png";
import GovLogoBank from "../assets/Gov_Bank_Logo.png";
import GovLogoLaw from "../assets/Gov_Law_Logo.png";
import Gov_Ubtz_Logo from "../assets/Gov_Ubtz_Logo.jpg";
import "./Home.css";

const { Title, Text } = Typography;
const { Option } = Select;

// -----------------------------------------------------------------------------
// STATIC DATA
// -----------------------------------------------------------------------------
const LOGOS = [
  { src: GovLogo, text: "САНГИЙН ЯАМ", url: "https://mof.gov.mn/" },
  { src: GovLogo, text: "ЗАМ, ТЭЭВРИЙН ЯАМ", url: "https://mrt.gov.mn/" },
  { src: GovLogo, text: "ХУУЛЬ ЗҮЙ, ДОТООД ХЭРГИЙН ЯАМ", url: "https://mojha.gov.mn/" },
  { src: GovLogoTender, text: "ТӨРИЙН ХУДАЛДАН АВАХ АЖИЛЛАГААНЫ СИСТЕМ", url: "https://tender.gov.mn/" },
  { src: GovLogoBank, text: "МОНГОЛБАНК", url: "https://www.mongolbank.mn/" },
  { src: GovLogoLaw, text: "ЭРХ ЗҮЙН МЭДЭЭЛЛИЙН НЭГДСЭН СИСТЕМ", url: "https://legalinfo.mn/" },
  { src: Gov_Ubtz_Logo, text: "УЛААНБААТАР ТӨМӨР ЗАМ", url: "https://ubtz.mn/" },
];

const PIE_DATASETS = {
  zam: [
    { name: "Гэрээ байгуулсан", value: 98446, color: "#3b82f6" },
    { name: "Тендер зарласан", value: 18174, color: "#f59e0b" },
    { name: "Тендерийн нээлт хийсэн", value: 15145, color: "#a855f7" },
    { name: "Түдгэлзүүлсэн", value: 572, color: "#22c55e" },
    { name: "Үр дүн нийтэлсэн", value: 12116, color: "#ec4899" },
  ],
  alban: [
    { name: "Гэрээ байгуулсан", value: 35412, color: "#3b82f6" },
    { name: "Тендер зарласан", value: 20456, color: "#f59e0b" },
    { name: "Тендерийн нээлт хийсэн", value: 11003, color: "#a855f7" },
    { name: "Түдгэлзүүлсэн", value: 421, color: "#22c55e" },
    { name: "Үр дүн нийтэлсэн", value: 9432, color: "#ec4899" },
  ],
  aan: [
    { name: "Гэрээ байгуулсан", value: 2134, color: "#3b82f6" },
    { name: "Тендер зарласан", value: 15234, color: "#f59e0b" },
    { name: "Тендерийн нээлт хийсэн", value: 8123, color: "#a855f7" },
    { name: "Түдгэлзүүлсэн", value: 302, color: "#22c55e" },
    { name: "Үр дүн нийтэлсэн", value: 7011, color: "#ec4899" },
  ],
};

const STATS = [
  {
    title: "НИЙТ ЗАРЛАГДСАН ТЕНДЕР",
    value: 62537154,
    count: 42,
    color: "#10b981",
    percent: 42,
    icon: <none />,
  },
  {
    title: "НИЙТ ТЕНДЕРИЙН ЗАХИАЛГА",
    value: 72256178,
    count: 772,
    color: "#f43f5e",
    percent: 8.4,
    icon: <none />,
  },
  {
    title: "БАЙГУУЛСАН ГЭРЭЭНИЙ ДҮН",
    value: 36275453,
    count: 162,
    color: "#3b82f6",
    percent: 49,
    icon: <none />,
  },
];

// -----------------------------------------------------------------------------
// COMPONENT
// -----------------------------------------------------------------------------
export default function Home() {
  const [scope, setScope] = useState("zam");
  const [selectedAAN, setSelectedAAN] = useState(null);
  const [branchList, setBranchList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const pieData = useMemo(() => PIE_DATASETS[scope], [scope]);
  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/get/Statistic`);
        setStats(res.data);
      } catch (err) {
        console.error("❌ Failed to fetch statistics:", err);
        message.error("Статистикийн мэдээлэл татаж чадсангүй!");
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStatistics();
  }, [API_BASE_URL]);


  useEffect(() => {
    axios
      .get("http://192.168.4.107:3636/get/branches")
      .then((res) => setBranchList(res.data || []))
      .catch(() => message.error("Хэлтсүүдийн мэдээлэл татаж чадсангүй!"))
      .finally(() => setLoading(false));
  }, []);

  const uniqueServices = useMemo(
    () => [...new Set(branchList.map((b) => b.service))],
    [branchList]
  );

  const chartOption = useMemo(
    () => ({
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      graphic: [
        {
          type: "text",
          left: "center",
          top: "middle",
          style: {
            text: `${pieData.reduce((s, d) => s + d.value, 0).toLocaleString()}\nНийт`,
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
            formatter: "{b}: {d}%",
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
    }),
    [pieData]
  );

  if (loading) return <Spin fullscreen size="large" tip="Түр хүлээнэ үү..." />;

  return (
    <div
      style={{
        padding: "24px 16px",
        background: "linear-gradient(180deg, #f9fafb 0%, #eef2f7 100%)",
        minHeight: "100vh",
      }}
    >
      {/* HEADER */}
      <Card
        style={{
          marginBottom: 24,
          textAlign: "center",
          borderRadius: 14,
          background: "linear-gradient(135deg, #ffffff, #f8fafc)",
          boxShadow: "0 3px 12px rgba(0,0,0,0.04)",
          padding: "10px 0", // 👈 Reduced padding
          height: 90,         // 👈 Controlled height
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 15, color: "#475569", fontWeight: 500 }}>
          НИЙТ ТЕНДЕРИЙН МӨНГӨН ДҮН (тэрбум төгрөгөөр)
        </Text>
        <Title
          level={3}
          style={{
            color: "#0f172a",
            marginTop: 4,
            marginBottom: 0,
            fontWeight: 700,
            lineHeight: 1,
            fontSize: 24, // slightly smaller
          }}
        >
          <CountUp end={151453} duration={2} separator="," />
        </Title>
      </Card>

      <Row gutter={32}>
        {/* LEFT PIE SECTION */}
        <Col xs={24} md={16}>
          <Card
            title={<Text style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>ТЕНДЕРИЙН ТОО МЭДЭЭ</Text>}
            style={{
              borderRadius: 20,
              boxShadow: "0 4px 25px rgba(0,0,0,0.08)",
              background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
              overflow: "hidden",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <Radio.Group
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
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                <Select
                  style={{ width: 320 }}
                  placeholder={scope === "alban" ? "Алба сонгох" : "ААН сонгох"}
                  value={selectedAAN}
                  onChange={setSelectedAAN}
                  showSearch
                  optionFilterProp="children"
                  variant={false}
                  styles={{ popup: { borderRadius: 12 } }}  // ✅ modern replacement
                >
                  {(scope === "alban" ? uniqueServices : branchList).map((b) => (
                    <Option key={b.id || b} value={b.id || b}>
                      {b.shortName ? `${b.shortName} — ${b.branch}` : b}
                    </Option>
                  ))}
                </Select>

              </div>
            )}

            {/* PIE CHART */}
            <div
              style={{
                background: "radial-gradient(circle at center, #f9fafb 0%, #f1f5f9 100%)",
                borderRadius: 20,
                padding: "40px 20px 30px",
                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.05)",
                textAlign: "center",
                transition: "all 0.3s ease",
              }}
            >
              <ReactECharts option={chartOption} style={{ height: 380 }} />

              {/* Modern Legend */}
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
                    <span style={{ fontWeight: 500, color: "#0f172a" }}>
                      {item.name}
                    </span>
                    <span style={{ color: "#475569" }}>
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Col>

        {/* RIGHT SIDE CARDS */}
        {/* ✅ RIGHT SIDE LIVE STATISTICS */}
        <Col xs={24} md={8}>
          {loadingStats ? (
            <Spin
              size="large"
              tip="Статистик ачаалж байна..."
              style={{ width: "100%", marginTop: 50 }}
            />
          ) : stats ? (
            <>
              {/* 🟢 НИЙТ ТЕНДЕРИЙН ЗАХИАЛГА */}
              <Card
                style={{
                  background: `linear-gradient(135deg, #10b98115, #10b98125)`,
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 20,
                  color: "#0f172a",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                  marginBottom: 20,
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                }}
                hoverable
                styles={{ body: { padding: "22px 26px" } }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow =
                    "0 12px 24px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 20px rgba(0,0,0,0.08)";
                }}
              >
                <Title level={4} style={{ color: "#0f172a", marginBottom: 10 }}>
                  НИЙТ ТЕНДЕРИЙН ЗАХИАЛГА
                </Title>
                <Text style={{ fontSize: 15, color: "#64748b" }}>
                  Тоо: {stats.TotalOrders}
                </Text>
                <br />
                <Text strong style={{ fontSize: 24, color: "#10b981" }}>
                  <CountUp end={stats.TotalOrderValue} duration={2} separator="," />
                </Text>
              </Card>

              {/* 🔴 НИЙТ ЗАРЛАГДСАН ТЕНДЕР */}
              <Card
                style={{
                  background: `linear-gradient(135deg, #f43f5e15, #f43f5e25)`,
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 20,
                  color: "#0f172a",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                  marginBottom: 20,
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                }}
                hoverable
                styles={{ body: { padding: "22px 26px" } }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow =
                    "0 12px 24px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 20px rgba(0,0,0,0.08)";
                }}
              >
                <Title level={4} style={{ color: "#0f172a", marginBottom: 10 }}>
                  НИЙТ ЗАРЛАГДСАН ТЕНДЕР
                </Title>
                <Text style={{ fontSize: 15, color: "#64748b" }}>
                  Тоо: {stats.TotalTenders}
                </Text>
                <br />
                <Text strong style={{ fontSize: 24, color: "#f43f5e" }}>
                  <CountUp end={stats.TotalBudget} duration={2} separator="," />
                </Text>
              </Card>

              {/* 🔵 БАЙГУУЛСАН ГЭРЭЭНИЙ ДҮН */}
              <Card
                style={{
                  background: `linear-gradient(135deg, #3b82f615, #3b82f625)`,
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 20,
                  color: "#0f172a",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                  marginBottom: 20,
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                }}
                hoverable
                styles={{ body: { padding: "22px 26px" } }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow =
                    "0 12px 24px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 20px rgba(0,0,0,0.08)";
                }}
              >
                <Title level={4} style={{ color: "#0f172a", marginBottom: 10 }}>
                  БАЙГУУЛСАН ГЭРЭЭНИЙ ДҮН
                </Title>
                <Text style={{ fontSize: 15, color: "#64748b" }}>
                  Тоо: {stats.TotalContracts}
                </Text>
                <br />
                <Text strong style={{ fontSize: 24, color: "#3b82f6" }}>
                  <CountUp end={stats.TotalContractValue} duration={2} separator="," />
                </Text>
              </Card>
            </>
          ) : (
            <Text type="secondary">Мэдээлэл олдсонгүй.</Text>
          )}
        </Col>


      </Row>

      {/* FOOTER LOGOS */}
      <div
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
