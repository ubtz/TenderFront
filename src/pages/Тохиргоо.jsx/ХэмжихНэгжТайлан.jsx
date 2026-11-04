import { useEffect, useRef, useState } from "react";
import {
    AppstoreOutlined,
    BarChartOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    DownloadOutlined,
    PieChartOutlined,
    RiseOutlined,
    TeamOutlined,
} from "@ant-design/icons";
import { Button, Empty, Modal, Progress, Table, Tag, Typography, message } from "antd";
import "./ХэмжихНэгжТайлан.css";

const { Text } = Typography;
const normalize = (value) => String(value ?? "").trim();
const numberFormat = new Intl.NumberFormat("mn-MN");

const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value) => {
    const date = value instanceof Date ? value : parseDate(value);
    if (!date) return "—";
    const pad = (part) => String(part).padStart(2, "0");
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getRecordDate = (record) => (
    parseDate(record?.editedAt)
    || parseDate(record?.updatedAt)
    || parseDate(record?.createdAt)
);

const getEditorName = (record) => normalize(
    record?.editedByUserName
    || record?.editedByUsername
    || record?.editedBy
    || record?.userName
) || "Нэр бүртгэгдээгүй";

const getUnitName = (record, unitById) => normalize(record?.measurementUnit)
    || unitById.get(Number(record?.measurementUnitId))
    || "Нэргүй нэгж";

const percentOf = (value, total) => total > 0 ? (value / total) * 100 : 0;

const toDayKey = (date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
].join("-");

const REPORT_CHUNK_SIZE = 2500;
const yieldToBrowser = () => new Promise((resolve) => window.setTimeout(resolve, 0));

const MetricCard = ({ className, icon, label, value, suffix }) => (
    <article className={`measurement-report-metric ${className}`}>
        <span className="measurement-report-metric__icon">{icon}</span>
        <div>
            <Text>{label}</Text>
            <strong>{numberFormat.format(value)}</strong>
            <b>{suffix}</b>
        </div>
    </article>
);

const ActivityChart = ({ data }) => {
    if (!data.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Огнооны мэдээлэл алга" />;

    const width = 760;
    const height = 250;
    const left = 46;
    const right = 18;
    const top = 24;
    const bottom = 48;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const maximum = Math.max(...data.map((item) => item.count), 1);
    const x = (index) => left + (data.length === 1 ? chartWidth / 2 : index * chartWidth / (data.length - 1));
    const y = (value) => top + chartHeight - (value / maximum) * chartHeight;
    const points = data.map((item, index) => `${x(index)},${y(item.count)}`).join(" ");
    const areaPoints = `${left},${top + chartHeight} ${points} ${left + chartWidth},${top + chartHeight}`;

    return (
        <svg className="measurement-activity-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Өдөр тутмын бүртгэл засварын график">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const gridY = top + chartHeight - ratio * chartHeight;
                const value = Math.round(maximum * ratio);
                return (
                    <g key={ratio}>
                        <line x1={left} y1={gridY} x2={left + chartWidth} y2={gridY} />
                        <text x={left - 8} y={gridY + 4} textAnchor="end">{numberFormat.format(value)}</text>
                    </g>
                );
            })}
            <polygon className="measurement-activity-chart__area" points={areaPoints} />
            <polyline className="measurement-activity-chart__line" points={points} />
            {data.map((item, index) => (
                <g key={item.key}>
                    <circle cx={x(index)} cy={y(item.count)} r="5" />
                    <text className="measurement-activity-chart__value" x={x(index)} y={y(item.count) - 11} textAnchor="middle">
                        {numberFormat.format(item.count)}
                    </text>
                    <text className="measurement-activity-chart__label" x={x(index)} y={height - 18} textAnchor="middle">
                        {item.label}
                    </text>
                </g>
            ))}
        </svg>
    );
};

const MeasurementReport = ({ open, onClose, codes, rules, units, measurementRecords }) => {
    const [report, setReport] = useState(null);
    const [reportProgress, setReportProgress] = useState(0);
    const [reportStage, setReportStage] = useState("");
    const [reportError, setReportError] = useState("");
    const [savingImage, setSavingImage] = useState(false);
    const reportRef = useRef(null);

    useEffect(() => {
        if (!open) {
            setReport(null);
            setReportProgress(0);
            setReportStage("");
            setReportError("");
            return undefined;
        }

        let cancelled = false;
        const updateProgress = (percent, stage) => {
            if (cancelled) return;
            setReportProgress(Math.min(100, Math.max(0, Math.round(percent))));
            setReportStage(stage);
        };

        setReport(null);
        setReportError("");
        updateProgress(2, "Тайлангийн өгөгдөл бэлтгэж байна...");

        const calculateReport = async () => {
            await yieldToBrowser();
            const generatedAt = new Date();
            const comparisonDate = new Date(generatedAt);
            comparisonDate.setDate(comparisonDate.getDate() - 7);
            const unitById = new Map(units.map((unit) => [Number(unit.id), normalize(unit.name)]));
            const rawRecords = Object.values(measurementRecords);
            const employeeMap = new Map();
            const mappedCodes = new Set();
            const unitMap = new Map();
            const activityMap = new Map();
            let mapped = 0;
            let weekAgoMapped = 0;
            let latestDate = null;

            for (let start = 0; start < rawRecords.length; start += REPORT_CHUNK_SIZE) {
                const end = Math.min(start + REPORT_CHUNK_SIZE, rawRecords.length);
                for (let index = start; index < end; index += 1) {
                    const record = rawRecords[index];
                    if (Number(record?.measurementUnitId) <= 0) continue;
                    mapped += 1;
                    const code = normalize(record.code);
                    const date = getRecordDate(record);
                    const name = getEditorName(record);
                    const unitName = getUnitName(record, unitById);
                    const employee = employeeMap.get(name) || {
                        name,
                        count: 0,
                        weekAgoCount: 0,
                        latestDate: null,
                    };
                    employee.count += 1;
                    if (!date || date <= comparisonDate) {
                        employee.weekAgoCount += 1;
                        weekAgoMapped += 1;
                    }
                    if (date && (!employee.latestDate || date > employee.latestDate)) {
                        employee.latestDate = date;
                    }
                    employeeMap.set(name, employee);
                    if (code) mappedCodes.add(code);
                    unitMap.set(unitName, (unitMap.get(unitName) || 0) + 1);
                    if (date) {
                        const key = toDayKey(date);
                        activityMap.set(key, (activityMap.get(key) || 0) + 1);
                        if (!latestDate || date > latestDate) latestDate = date;
                    }
                }
                updateProgress(5 + (end / Math.max(rawRecords.length, 1)) * 48, "Хэмжих нэгжийн бүртгэл тооцоолж байна...");
                await yieldToBrowser();
                if (cancelled) return;
            }

            const categoryCounts = new Map(rules.map((rule) => [normalize(rule.no), {
                total: 0,
                mapped: 0,
            }]));
            for (let start = 0; start < codes.length; start += REPORT_CHUNK_SIZE) {
                const end = Math.min(start + REPORT_CHUNK_SIZE, codes.length);
                for (let index = start; index < end; index += 1) {
                    const codeNumber = normalize(codes[index].no);
                    const count = categoryCounts.get(codeNumber.slice(0, 2));
                    if (!count) continue;
                    count.total += 1;
                    if (mappedCodes.has(codeNumber)) count.mapped += 1;
                }
                updateProgress(53 + (end / Math.max(codes.length, 1)) * 37, "Ангиллын гүйцэтгэл нэгтгэж байна...");
                await yieldToBrowser();
                if (cancelled) return;
            }

            updateProgress(93, "Хүснэгт болон график байгуулж байна...");
            const total = codes.length;
            const remaining = Math.max(total - mapped, 0);
            const completion = percentOf(mapped, total);
            const weeklyGrowth = Math.max(mapped - weekAgoMapped, 0);
            const weeklyGrowthPercent = weekAgoMapped > 0
                ? percentOf(weeklyGrowth, weekAgoMapped)
                : weeklyGrowth > 0 ? 100 : 0;
            const employees = [...employeeMap.values()]
                .map((employee) => ({
                    ...employee,
                    key: employee.name,
                    share: percentOf(employee.count, mapped),
                    growth: Math.max(employee.count - employee.weekAgoCount, 0),
                }))
                .sort((first, second) => second.count - first.count);
            const categories = rules.map((rule) => {
                const ruleNo = normalize(rule.no);
                const count = categoryCounts.get(ruleNo) || { total: 0, mapped: 0 };
                return {
                    key: ruleNo,
                    no: ruleNo,
                    name: normalize(rule.name) || "Нэргүй ангилал",
                    total: count.total,
                    mapped: count.mapped,
                    remaining: Math.max(count.total - count.mapped, 0),
                    completion: percentOf(count.mapped, count.total),
                };
            }).sort((first, second) => second.mapped - first.mapped);
            const unitDistribution = [...unitMap.entries()]
                .map(([name, count]) => ({ name, count, share: percentOf(count, mapped) }))
                .sort((first, second) => second.count - first.count);
            const activity = Array.from({ length: 8 }, (_, index) => {
                const date = new Date(comparisonDate);
                date.setHours(0, 0, 0, 0);
                date.setDate(date.getDate() + index);
                const key = toDayKey(date);
                return {
                    key,
                    count: activityMap.get(key) || 0,
                    label: key.slice(5).replace("-", "."),
                };
            });

            await yieldToBrowser();
            if (cancelled) return;
            setReport({
                total,
                mapped,
                remaining,
                completion,
                generatedAt,
                comparisonDate,
                weekAgoMapped,
                weeklyGrowth,
                weeklyGrowthPercent,
                latestDate,
                employees,
                categories,
                unitDistribution,
                activity,
            });
            updateProgress(100, "Тайлан бэлэн боллоо");
        };

        calculateReport().catch((error) => {
            console.error("Measurement report calculation failed:", error);
            if (cancelled) return;
            setReportError("Тайлан тооцоолоход алдаа гарлаа");
            setReportStage("Дахин оролдоно уу.");
        });

        return () => {
            cancelled = true;
        };
    }, [codes, measurementRecords, open, rules, units]);

    const modalProps = {
        open,
        onCancel: onClose,
        footer: null,
        width: "min(1560px, 97vw)",
        destroyOnHidden: true,
        centered: true,
        className: "measurement-report-modal",
        rootClassName: "measurement-report-modal-root",
        styles: { body: { maxHeight: "calc(100vh - 92px)", overflow: "auto", padding: 0 } },
    };

    if (!report) {
        return (
            <Modal {...modalProps}>
                <div className="measurement-report-loading">
                    <span className="measurement-report-loading__icon"><BarChartOutlined /></span>
                    <h2>Тайлан бэлтгэж байна</h2>
                    <Progress
                        percent={reportProgress}
                        status={reportError ? "exception" : "active"}
                        strokeColor={{ from: "#7351d5", to: "#42b3df" }}
                    />
                    <Text type={reportError ? "danger" : "secondary"}>{reportError || reportStage}</Text>
                </div>
            </Modal>
        );
    }

    const handleSaveImage = async () => {
        const reportElement = reportRef.current;
        if (!reportElement || savingImage) return;
        setSavingImage(true);
        reportElement.classList.add("is-capturing");
        try {
            await new Promise((resolve) => window.requestAnimationFrame(resolve));
            const { default: html2canvas } = await import("html2canvas");
            const captureOptions = {
                backgroundColor: "#f3f7fc",
                logging: false,
                scale: Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2),
                scrollX: 0,
                scrollY: -window.scrollY,
                useCORS: true,
                windowWidth: reportElement.scrollWidth,
                windowHeight: reportElement.scrollHeight,
                onclone: (clonedDocument) => {
                    const clonedReport = clonedDocument.querySelector(".measurement-report");
                    if (clonedReport) clonedReport.style.backgroundImage = "none";
                    clonedReport?.querySelectorAll("*").forEach((element) => {
                        element.style.backgroundImage = "none";
                    });
                },
            };
            let canvas;
            try {
                canvas = await html2canvas(reportElement, captureOptions);
            } catch (standardCaptureError) {
                console.warn("Standard report capture failed; trying browser rendering:", standardCaptureError);
                canvas = await html2canvas(reportElement, {
                    ...captureOptions,
                    foreignObjectRendering: true,
                    scale: 1.5,
                });
            }
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
            if (!blob) throw new Error("PNG image generation failed");
            const imageUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = imageUrl;
            link.download = `Хэмжих-нэгжийн-тайлан-${toDayKey(new Date())}.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
            message.success("Тайлан зураг хэлбэрээр хадгалагдлаа");
        } catch (error) {
            console.error("Measurement report image save failed:", error);
            message.error("Тайланг зураг болгон хадгалахад алдаа гарлаа");
        } finally {
            reportElement.classList.remove("is-capturing");
            setSavingImage(false);
        }
    };

    const employeeColumns = [
        { title: "№", width: 54, align: "center", render: (_, __, index) => index + 1 },
        { title: "Ажилтны нэр", dataIndex: "name", key: "name", ellipsis: true },
        {
            title: "7 хоногийн өмнө",
            dataIndex: "weekAgoCount",
            key: "weekAgoCount",
            width: 130,
            align: "right",
            render: (value) => numberFormat.format(value),
        },
        {
            title: "Өнөөдөр",
            dataIndex: "count",
            key: "count",
            width: 105,
            align: "right",
            render: (value) => <Text strong>{numberFormat.format(value)}</Text>,
        },
        {
            title: "Өсөлт",
            dataIndex: "growth",
            key: "growth",
            width: 100,
            align: "right",
            render: (value) => <Tag color={value > 0 ? "success" : "default"}>+{numberFormat.format(value)}</Tag>,
        },
        {
            title: "Нийтэд эзлэх хувь",
            dataIndex: "share",
            key: "share",
            width: 210,
            render: (value) => (
                <div className="measurement-inline-progress">
                    <span><i style={{ width: `${Math.max(value, 1)}%` }} /></span>
                    <b>{value.toFixed(2)}%</b>
                </div>
            ),
        },
        {
            title: "Сүүлийн өөрчлөлт",
            dataIndex: "latestDate",
            key: "latestDate",
            width: 170,
            render: formatDateTime,
        },
    ];

    return (
        <Modal {...modalProps}>
            <main className="measurement-report" ref={reportRef}>
                <header className="measurement-report-hero">
                    <div>
                        <h1><AppstoreOutlined /> Бараа, материалын нэр төрлийн бүртгэл</h1>
                        <p>Хэмжих нэгжийн бүртгэл болон ажилтнуудын гүйцэтгэлийн нэгдсэн тайлан</p>
                    </div>
                    <div className="measurement-report-hero__date">
                        <strong>{report.generatedAt.toLocaleDateString("mn-MN")}</strong>
                        <span>{report.generatedAt.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })} цагийн байдлаар</span>
                    </div>
                </header>

                <div className="measurement-report-toolbar">
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        loading={savingImage}
                        onClick={handleSaveImage}
                    >
                        Зураг болгон хадгалах
                    </Button>
                </div>

                <section className="measurement-report-metrics">
                    <MetricCard className="is-blue" icon={<AppstoreOutlined />} label="Нийт бараа, материал" value={report.total} suffix="100%" />
                    <MetricCard className="is-green" icon={<CheckCircleOutlined />} label="Хэмжих нэгж бүртгэсэн" value={report.mapped} suffix={`${report.completion.toFixed(2)}%`} />
                    <MetricCard className="is-orange" icon={<ClockCircleOutlined />} label="Бүртгэх үлдэгдэл" value={report.remaining} suffix={`${(100 - report.completion).toFixed(2)}%`} />
                    <MetricCard className="is-violet" icon={<TeamOutlined />} label="Бүртгэл хийсэн ажилтан" value={report.employees.length} suffix="хүн" />
                </section>

                <section className="measurement-report-layout">
                    <div className="measurement-report-main">
                        <article className="measurement-report-panel">
                            <h2><TeamOutlined /> Ажилтан тус бүрийн бүртгэл <small>(одоогийн хариуцагчаар)</small></h2>
                            <Table
                                size="small"
                                rowKey="key"
                                columns={employeeColumns}
                                dataSource={report.employees}
                                pagination={false}
                                scroll={{ x: 820 }}
                                locale={{ emptyText: <Empty description="Ажилтны мэдээлэл алга" /> }}
                            />
                        </article>

                        <div className="measurement-report-lower">
                            <article className="measurement-report-panel">
                                <h2><BarChartOutlined /> Ангиллын бүртгэлийн явц</h2>
                                <div className="measurement-category-list">
                                    {report.categories.map((category) => (
                                        <div className="measurement-category-row" key={category.key}>
                                            <div>
                                                <Tag>{category.no}</Tag>
                                                <Text ellipsis={{ tooltip: category.name }}>{category.name}</Text>
                                            </div>
                                            <span>
                                                {category.completion > 0 && (
                                                    <i style={{ width: `${Math.min(category.completion, 100)}%` }} />
                                                )}
                                            </span>
                                            <b>{numberFormat.format(category.mapped)} / {numberFormat.format(category.total)}</b>
                                            <em>{category.completion.toFixed(1)}%</em>
                                        </div>
                                    ))}
                                </div>
                            </article>

                            <article className="measurement-report-panel">
                                <h2><BarChartOutlined /> Өдөр тутмын бүртгэл / засварын идэвх</h2>
                                <ActivityChart data={report.activity} />
                            </article>
                        </div>
                    </div>

                    <aside className="measurement-report-side">
                        <article className="measurement-report-panel measurement-week-comparison">
                            <h2><RiseOutlined /> 7 хоногийн харьцуулалт</h2>
                            <div className="measurement-week-comparison__dates">
                                <div>
                                    <span>{report.comparisonDate.toLocaleDateString("mn-MN")}</span>
                                    <strong>{numberFormat.format(report.weekAgoMapped)}</strong>
                                    <small>7 хоногийн өмнө</small>
                                </div>
                                <b>→</b>
                                <div>
                                    <span>{report.generatedAt.toLocaleDateString("mn-MN")}</span>
                                    <strong>{numberFormat.format(report.mapped)}</strong>
                                    <small>Өнөөдөр</small>
                                </div>
                            </div>
                            <div className="measurement-week-comparison__growth">
                                <span>7 хоногт нэмэгдсэн</span>
                                <strong>+{numberFormat.format(report.weeklyGrowth)}</strong>
                                <b>+{report.weeklyGrowthPercent.toFixed(2)}%</b>
                            </div>
                        </article>

                        <article className="measurement-report-panel">
                            <h2><PieChartOutlined /> Нийт бүртгэлд эзлэх хувь</h2>
                            <div className="measurement-report-donut">
                                <svg viewBox="0 0 120 120" aria-hidden="true">
                                    <circle className="measurement-report-donut__track" cx="60" cy="60" r="52" />
                                    <circle
                                        className="measurement-report-donut__value"
                                        cx="60"
                                        cy="60"
                                        r="52"
                                        pathLength="100"
                                        strokeDasharray={`${report.completion} ${Math.max(100 - report.completion, 0)}`}
                                    />
                                </svg>
                                <div className="measurement-report-donut__center">
                                    <strong>{numberFormat.format(report.total)}</strong>
                                    <span>нийт код</span>
                                    <b>{report.completion.toFixed(2)}%</b>
                                </div>
                            </div>
                            <div className="measurement-report-legend"><span><i className="is-complete" />Бүртгэсэн</span><b>{numberFormat.format(report.mapped)}</b></div>
                            <div className="measurement-report-legend"><span><i />Үлдсэн</span><b>{numberFormat.format(report.remaining)}</b></div>
                        </article>

                        <article className="measurement-report-panel">
                            <h2><CheckCircleOutlined /> Хэмжих нэгжийн тархалт</h2>
                            <div className="measurement-unit-ranking">
                                {report.unitDistribution.slice(0, 12).map((unit, index) => (
                                    <div key={unit.name}>
                                        <span>{index + 1}</span>
                                        <Text className="measurement-unit-ranking__name">{unit.name}</Text>
                                        <b>{numberFormat.format(unit.count)}</b>
                                        <em>{unit.share.toFixed(1)}%</em>
                                    </div>
                                ))}
                            </div>
                        </article>
                    </aside>
                </section>

                <p className="measurement-report-note">
                    Тайлбар: 7 хоногийн өмнөх дүнг кодын хамгийн сүүлийн “Оруулсан / зассан” огноогоор тооцсон.
                </p>
            </main>
        </Modal>
    );
};

export default MeasurementReport;
