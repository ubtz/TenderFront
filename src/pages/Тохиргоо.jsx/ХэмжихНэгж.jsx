import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Button,
    Card,
    Empty,
    Input,
    Modal,
    Select,
    Space,
    Spin,
    Statistic,
    Table,
    Tabs,
    Tag,
    Tree,
    Typography,
    message,
} from "antd";
import {
    ApartmentOutlined,
    BarChartOutlined,
    SaveOutlined,
    SearchOutlined,
    UserOutlined,
} from "@ant-design/icons";
import axios from "axios";
import "./ХэмжихНэгж.css";
import MeasurementReport from "./ХэмжихНэгжТайлан";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const { Text, Title } = Typography;
const normalize = (value) => String(value ?? "").trim();
const formatCposCode = (value) => {
    const original = normalize(value);
    const code = original.replace(/-/g, "");
    if (!/^\d{14}$/.test(code)) return original || "-";
    return code.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})(\d{3})$/, "$1-$2-$3-$4-$5-$6");
};
const searchable = (value) => normalize(value).toLocaleLowerCase();
const codePrefixLengths = [2, 4, 6, 8, 11, 14];

const commonTextPrefix = (first, second) => {
    const firstText = normalize(first);
    const secondText = normalize(second);
    const limit = Math.min(firstText.length, secondText.length);
    let index = 0;
    while (index < limit && firstText[index].toLocaleLowerCase() === secondText[index].toLocaleLowerCase()) {
        index += 1;
    }
    return firstText.slice(0, index).trim().replace(/[\s,;:/-]+$/, "");
};

const updateTreeNode = (nodes, key, children) => nodes.map((node) => {
    if (node.key === key) return { ...node, children };
    if (!node.children) return node;
    return { ...node, children: updateTreeNode(node.children, key, children) };
});

const MeasureUnits = () => {
    const [rules, setRules] = useState([]);
    const [codes, setCodes] = useState([]);
    const [units, setUnits] = useState([]);
    const [selectedRule, setSelectedRule] = useState("all");
    const [selectedTopRule, setSelectedTopRule] = useState("all");
    const [measurementStatus, setMeasurementStatus] = useState("all");
    const [codeSearch, setCodeSearch] = useState("");
    const [columnFilters, setColumnFilters] = useState({
        code: "",
        name: "",
        mark: "",
        partnumber: "",
        sourceUnit: "",
        measurementUnit: "",
        editedBy: "",
    });
    const [unitSearch, setUnitSearch] = useState("");
    const [codePage, setCodePage] = useState(1);
    const [codePageSize, setCodePageSize] = useState(50);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [codeTreeData, setCodeTreeData] = useState([]);
    const [measurementRecords, setMeasurementRecords] = useState({});
    const [measurementDrafts, setMeasurementDrafts] = useState({});
    const [savingCodes, setSavingCodes] = useState(() => new Set());
    const [bulkImportOpen, setBulkImportOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [bulkImportText, setBulkImportText] = useState("");
    const [bulkImporting, setBulkImporting] = useState(false);
    const deferredCodeSearch = useDeferredValue(codeSearch);
    const deferredColumnFilters = useDeferredValue(columnFilters);

    useEffect(() => {
        let active = true;
        const loadData = async () => {
            setLoading(true);
            setError("");
            try {
                const [codeResponse, measurementResponse] = await Promise.all([
                    axios.post(`${API_BASE_URL}/external/cpos/code`, {}),
                    axios.get(`${API_BASE_URL}/get/CposCodeMeasurementDetails`),
                ]);

                console.log("CPOS code response:", codeResponse.data);
                console.log("CPOS measurement response:", measurementResponse.data);
                if (!codeResponse.data?.status) {
                    throw new Error(codeResponse.data?.message || "CPOS code data error");
                }
                if (!active) return;
                setRules(Array.isArray(codeResponse.data.rule1) ? codeResponse.data.rule1 : []);
                setCodes(Array.isArray(codeResponse.data.code)
                    ? codeResponse.data.code.map((code, index) => ({
                        ...code,
                        __rowKey: `${normalize(code.no) || "code"}-${index}`,
                    }))
                    : []);
                const loadedUnits = Array.isArray(codeResponse.data.units)
                    ? codeResponse.data.units
                    : [];
                setUnits(loadedUnits);
                const unitIdByName = new Map(loadedUnits.map((unit) => [
                    normalize(unit.name),
                    Number(unit.id),
                ]));
                const savedMeasurements = Object.fromEntries(
                    (Array.isArray(measurementResponse.data) ? measurementResponse.data : [])
                        .map((item) => [normalize(item.code), {
                            ...item,
                            measurementUnit: normalize(item.measurementUnit),
                            measurementUnitId: Number(item.measurementUnitId)
                                || unitIdByName.get(normalize(item.measurementUnit))
                                || null,
                        }])
                );
                setMeasurementRecords(savedMeasurements);
                setMeasurementDrafts(Object.fromEntries(
                    Object.entries(savedMeasurements).map(([code, item]) => [code, item.measurementUnitId])
                ));
            } catch (requestError) {
                console.error("CPOS code fetch failed:", requestError);
                if (!active) return;
                const errorMessage = requestError.response?.data?.error || "Ангилал, кодын мэдээлэл татахад алдаа гарлаа";
                setError(errorMessage);
                message.error(errorMessage);
            } finally {
                if (active) setLoading(false);
            }
        };
        loadData();
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        setCodePage(1);
    }, [selectedRule, deferredCodeSearch, deferredColumnFilters]);

    const ruleMap = useMemo(
        () => new Map(rules.map((rule) => [normalize(rule.no), normalize(rule.name)])),
        [rules]
    );

    const hasMeasurementMapping = useCallback((code) => {
        const saved = measurementRecords[normalize(code)];
        return Number(saved?.measurementUnitId) > 0;
    }, [measurementRecords]);

    const hierarchyIndex = useMemo(() => {
        const children = new Map();
        const metadata = new Map();

        codes.forEach((code) => {
            const codeNumber = normalize(code.no);
            let parentPrefix = "all";
            codePrefixLengths.forEach((length) => {
                if (codeNumber.length < length) return;
                const prefix = codeNumber.slice(0, length);
                if (!children.has(parentPrefix)) children.set(parentPrefix, new Set());
                children.get(parentPrefix).add(prefix);

                const current = metadata.get(prefix);
                metadata.set(prefix, {
                    count: (current?.count || 0) + 1,
                    commonName: current
                        ? commonTextPrefix(current.commonName, code.name)
                        : normalize(code.name),
                    sampleName: current?.sampleName || normalize(code.name),
                    sampleMark: current?.sampleMark || normalize(code.mark),
                    rule2: current?.rule2 || normalize(code.rule2),
                    levelLength: length,
                });
                parentPrefix = prefix;
            });
        });

        return {
            children: new Map([...children].map(([key, values]) => [key, [...values].sort()])),
            metadata,
        };
    }, [codes]);

    const createCodeTreeNode = useCallback((prefix) => {
        const metadata = hierarchyIndex.metadata.get(prefix);
        const isLeaf = prefix.length === codePrefixLengths[codePrefixLengths.length - 1];
        const categoryName = prefix.length === 2 ? ruleMap.get(prefix) : "";
        const secondLevelName = prefix.length === 4 ? normalize(metadata?.rule2) : "";
        const commonName = normalize(metadata?.commonName);
        const leafName = [metadata?.sampleName, metadata?.sampleMark]
            .map(normalize)
            .filter(Boolean)
            .join(" · ");
        const descriptiveName = categoryName
            || secondLevelName
            || (isLeaf && leafName)
            || (commonName.length >= 3 ? commonName : "Кодын бүлэг");
        return {
            key: prefix,
            title: `${prefix} · ${descriptiveName} (${(metadata?.count || 0).toLocaleString()})`,
            isLeaf,
        };
    }, [hierarchyIndex, ruleMap]);

    useEffect(() => {
        const secondLevelPrefixes = selectedTopRule === "all"
            ? rules.flatMap((rule) => hierarchyIndex.children.get(normalize(rule.no)) || [])
            : hierarchyIndex.children.get(selectedTopRule) || [];
        setCodeTreeData([...new Set(secondLevelPrefixes)].sort().map(createCodeTreeNode));
    }, [createCodeTreeNode, hierarchyIndex, rules, selectedTopRule]);

    const loadCodeTreeNode = useCallback((node) => {
        if (node.children || node.isLeaf) return Promise.resolve();
        const childPrefixes = hierarchyIndex.children.get(String(node.key)) || [];
        setCodeTreeData((currentTree) => updateTreeNode(
            currentTree,
            node.key,
            childPrefixes.map(createCodeTreeNode)
        ));
        return Promise.resolve();
    }, [createCodeTreeNode, hierarchyIndex]);

    const filteredCodes = useMemo(() => {
        const query = searchable(deferredCodeSearch);
        return codes.filter((code) => {
            const matchesRule = selectedRule === "all" || normalize(code.no).startsWith(selectedRule);
            if (!matchesRule) return false;
            const hasMapping = hasMeasurementMapping(code.no);
            if (measurementStatus === "mapped" && !hasMapping) return false;
            if (measurementStatus === "unmapped" && hasMapping) return false;
            const measurement = measurementRecords[normalize(code.no)];
            const measurementUnitId = Object.prototype.hasOwnProperty.call(
                measurementDrafts,
                normalize(code.no)
            )
                ? Number(measurementDrafts[normalize(code.no)]) || null
                : Number(measurement?.measurementUnitId) || null;
            const measurementUnitName = units.find(
                (unit) => Number(unit.id) === measurementUnitId
            )?.name || measurement?.measurementUnit || "";
            const editedAt = measurement?.editedAt
                ? new Date(measurement.editedAt).toLocaleString("mn-MN")
                : "";
            const columnValues = {
                code: `${normalize(code.no)} ${formatCposCode(code.no)}`,
                name: code.name,
                mark: code.mark,
                partnumber: code.partnumber,
                sourceUnit: code.negj,
                measurementUnit: measurementUnitName,
                editedBy: `${measurement?.editedByUserName || ""} ${measurement?.editedAt || ""} ${editedAt}`,
            };
            const matchesColumns = Object.entries(deferredColumnFilters).every(
                ([key, value]) => !searchable(value)
                    || searchable(columnValues[key]).includes(searchable(value))
            );
            if (!matchesColumns) return false;
            if (!query) return true;
            return [
                code.no,
                code.name,
                code.rule2,
                code.mark,
                code.partnumber,
                code.negj,
                code.barcode,
                measurement?.measurementUnit,
                measurement?.editedByUserName,
            ]
                .some((value) => searchable(value).includes(query));
        });
    }, [
        codes,
        deferredCodeSearch,
        deferredColumnFilters,
        hasMeasurementMapping,
        measurementDrafts,
        measurementRecords,
        measurementStatus,
        selectedRule,
        units,
    ]);

    const mappedCodeCount = useMemo(
        () => codes.filter((code) => hasMeasurementMapping(code.no)).length,
        [codes, hasMeasurementMapping]
    );

    const filteredUnits = useMemo(() => {
        const query = searchable(unitSearch);
        if (!query) return units;
        return units.filter((unit) => [unit.id, unit.name]
            .some((value) => searchable(value).includes(query)));
    }, [unitSearch, units]);

    const bulkImportPreview = useMemo(() => {
        const codeMap = new Map(codes.map((code) => [normalize(code.no), code]));
        const unitMap = new Map(units.map((unit) => [searchable(unit.name), unit]));
        const rowsByCode = new Map();
        const errors = [];
        let duplicateCount = 0;

        bulkImportText.split(/\r?\n/).forEach((rawLine, index) => {
            const line = rawLine.trim();
            if (!line) return;
            const match = line.match(/^'?(\d+)\s+(.+)$/);
            if (!match) {
                errors.push(`${index + 1}-р мөр: "Код Хэмжих нэгж" хэлбэртэй биш байна`);
                return;
            }
            const inputCode = match[1];
            const code = inputCode.length === 13 ? `0${inputCode}` : inputCode;
            const record = codeMap.get(code);
            if (!record) {
                errors.push(`${index + 1}-р мөр: ${inputCode} код CPOS жагсаалтад олдсонгүй`);
                return;
            }
            const unit = unitMap.get(searchable(match[2]));
            if (!unit) {
                errors.push(`${index + 1}-р мөр: "${normalize(match[2])}" хэмжих нэгж олдсонгүй`);
                return;
            }
            if (rowsByCode.has(code)) duplicateCount += 1;
            rowsByCode.set(code, { code, inputCode, record, unit });
        });

        return {
            rows: [...rowsByCode.values()],
            errors,
            duplicateCount,
        };
    }, [bulkImportText, codes, units]);

    const buildMeasurementPayload = (record, measurementUnitId) => {
        const code = normalize(record.no);
        const selectedUnit = units.find((unit) => Number(unit.id) === Number(measurementUnitId));
        return {
            code,
            name: normalize(record.name),
            mark: normalize(record.mark),
            barcode: normalize(record.barcode),
            sourceUnit: normalize(record.negj),
            rule1No: code.slice(0, 2),
            rule1Name: ruleMap.get(code.slice(0, 2)) || "",
            rule2: normalize(record.rule2),
            measurementUnit: normalize(selectedUnit?.name) || null,
            measurementUnitId: Number(selectedUnit?.id) || null,
        };
    };

    const saveMeasurement = async (record) => {
        const code = normalize(record.no);
        const measurementUnitId = Number(measurementDrafts[code]) || null;
        const payload = buildMeasurementPayload(record, measurementUnitId);
        console.log("[CposCodeMeasurement] save request", payload);
        setSavingCodes((current) => new Set(current).add(code));
        try {
            const response = await axios.put(`${API_BASE_URL}/put/CposCodeMeasurement`, payload);
            console.log("[CposCodeMeasurement] save response", response.data);
            const saved = {
                ...response.data,
                measurementUnit: normalize(response.data?.measurementUnit),
                measurementUnitId: Number(response.data?.measurementUnitId) || null,
            };
            setMeasurementRecords((current) => ({ ...current, [code]: saved }));
            setMeasurementDrafts((current) => ({ ...current, [code]: saved.measurementUnitId }));
            message.success(`${code} кодын хэмжих нэгж хадгалагдлаа`);
        } catch (requestError) {
            console.error("Measurement unit save failed:", requestError);
            message.error(requestError.response?.data?.error || "Хэмжих нэгж хадгалахад алдаа гарлаа");
        } finally {
            setSavingCodes((current) => {
                const next = new Set(current);
                next.delete(code);
                return next;
            });
        }
    };

    const importMeasurements = async () => {
        if (bulkImportPreview.errors.length || !bulkImportPreview.rows.length) return;
        setBulkImporting(true);
        try {
            const response = await axios.put(`${API_BASE_URL}/put/CposCodeMeasurements`, {
                items: bulkImportPreview.rows.map(({ record, unit }) => (
                    buildMeasurementPayload(record, unit.id)
                )),
            });
            const savedItems = Array.isArray(response.data?.items) ? response.data.items : [];
            const savedByCode = Object.fromEntries(savedItems.map((item) => [normalize(item.code), {
                ...item,
                measurementUnit: normalize(item.measurementUnit),
                measurementUnitId: Number(item.measurementUnitId) || null,
            }]));
            setMeasurementRecords((current) => ({ ...current, ...savedByCode }));
            setMeasurementDrafts((current) => ({
                ...current,
                ...Object.fromEntries(Object.entries(savedByCode).map(([code, item]) => [
                    code,
                    item.measurementUnitId,
                ])),
            }));
            message.success(
                `${response.data?.inserted || 0} код нэмэгдэж, ${response.data?.updated || 0} код шинэчлэгдлээ`
            );
            setBulkImportOpen(false);
            setBulkImportText("");
        } catch (requestError) {
            console.error("Bulk measurement import failed:", requestError);
            message.error(requestError.response?.data?.error || "Олноор хадгалахад алдаа гарлаа");
        } finally {
            setBulkImporting(false);
        }
    };

    const columnTitle = (label, filterKey) => (
        <div className="measurement-column-title">
            <span>{label}</span>
            <Input
                allowClear
                size="small"
                placeholder="Хайх"
                value={columnFilters[filterKey]}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                onChange={(event) => setColumnFilters((current) => ({
                    ...current,
                    [filterKey]: event.target.value,
                }))}
            />
        </div>
    );

    const codeColumns = [
        {
            title: columnTitle("Код", "code"),
            dataIndex: "no",
            key: "no",
            width: 165,
            fixed: "left",
            render: (value) => (
                <Text copyable={{ text: normalize(value) }} code>{formatCposCode(value)}</Text>
            ),
        },
        {
            title: columnTitle("Барааны нэр", "name"),
            dataIndex: "name",
            key: "name",
            width: 300,
            ellipsis: true,
            render: (value) => <Text strong>{normalize(value) || "-"}</Text>,
        },
        {
            title: columnTitle("Марк", "mark"),
            dataIndex: "mark",
            key: "mark",
            width: 220,
            ellipsis: true,
            render: (value) => normalize(value) || "-",
        },
        {
            title: columnTitle("Зургийн дугаар", "partnumber"),
            dataIndex: "partnumber",
            key: "partnumber",
            width: 160,
            ellipsis: true,
            render: (value) => normalize(value) || "-",
        },
        {
            title: columnTitle("Нэгж", "sourceUnit"),
            dataIndex: "negj",
            key: "negj",
            width: 110,
            render: (value) => normalize(value)
                ? <Tag bordered={false} color="cyan">{normalize(value)}</Tag>
                : "-",
        },
        {
            title: columnTitle("Хэмжих нэгж", "measurementUnit"),
            key: "measurementUnit",
            width: 265,
            render: (_, record) => {
                const code = normalize(record.no);
                const isStored = Object.prototype.hasOwnProperty.call(measurementRecords, code);
                const savedValue = Number(measurementRecords[code]?.measurementUnitId) || null;
                const draftValue = Object.prototype.hasOwnProperty.call(measurementDrafts, code)
                    ? Number(measurementDrafts[code]) || null
                    : savedValue;
                const changed = draftValue !== savedValue;
                const canSave = draftValue > 0 && (!isStored || changed);
                return (
                    <Space.Compact block>
                        <Select
                            showSearch
                            value={draftValue ?? undefined}
                            placeholder="Нэгж сонгох"
                            optionFilterProp="label"
                            options={units.map((unit) => ({
                                value: Number(unit.id),
                                label: normalize(unit.name),
                            }))}
                            onChange={(value) => setMeasurementDrafts((current) => ({
                                ...current,
                                [code]: value ?? null,
                            }))}
                            style={{ width: "100%" }}
                        />
                        <Button
                            type={canSave ? "primary" : "default"}
                            icon={<SaveOutlined />}
                            loading={savingCodes.has(code)}
                            disabled={!canSave}
                            onClick={() => saveMeasurement(record)}
                        >
                            {isStored ? "Хадгалах" : "Оруулах"}
                        </Button>
                    </Space.Compact>
                );
            },
        },
        {
            title: columnTitle("Оруулсан / зассан", "editedBy"),
            key: "editedBy",
            width: 190,
            render: (_, record) => {
                const saved = measurementRecords[normalize(record.no)];
                if (!saved?.editedByUserName) return null;
                return (
                    <Space direction="vertical" size={1}>
                        <Space size={5}><UserOutlined /><Text>{saved.editedByUserName}</Text></Space>
                        {saved.editedAt && (
                            <Text type="secondary" className="measurement-edited-at">
                                {new Date(saved.editedAt).toLocaleString("mn-MN")}
                            </Text>
                        )}
                    </Space>
                );
            },
        },
        // {
        //     title: "Баркод",
        //     dataIndex: "barcode",
        //     key: "barcode",
        //     width: 175,
        //     render: (value) => normalize(value)
        //         ? <Space size={6}><BarcodeOutlined /><Text copyable>{normalize(value)}</Text></Space>
        //         : "-",
        // },
    ];

    const selectedMetadata = hierarchyIndex.metadata.get(selectedRule);
    const selectedRuleName = selectedRule === "all"
        ? "Бүх код"
        : ruleMap.get(selectedRule)
            || normalize(selectedMetadata?.rule2)
            || normalize(selectedMetadata?.commonName)
            || `Кодын бүлэг ${selectedRule}`;

    const codeView = (
        <>
            <Card className="cpos-rule-buttons" size="small">
                <div className="cpos-rule-buttons__header">
                    <Space size={8}>
                        <ApartmentOutlined />
                        <Text strong>Ерөнхий ангиллаар шүүх</Text>
                    </Space>
                    <Text type="secondary">Ангилал сонгоод кодын шатлалыг нарийвчилна уу.</Text>
                </div>
                <Space wrap size={[7, 7]}>
                    <Button
                        type={selectedTopRule === "all" ? "primary" : "default"}
                        onClick={() => {
                            setSelectedTopRule("all");
                            setSelectedRule("all");
                        }}
                    >
                        Бүгд · {codes.length.toLocaleString()}
                    </Button>
                    {rules.map((rule) => {
                        const ruleNo = normalize(rule.no);
                        const isActive = selectedTopRule === ruleNo;
                        return (
                            <Button
                                key={ruleNo}
                                type={isActive ? "primary" : "default"}
                                onClick={() => {
                                    setSelectedTopRule(ruleNo);
                                    setSelectedRule(ruleNo);
                                }}
                            >
                                {ruleNo} · {normalize(rule.name)} · {(hierarchyIndex.metadata.get(ruleNo)?.count || 0).toLocaleString()}
                            </Button>
                        );
                    })}
                </Space>
            </Card>
            <div className="cpos-browser">
            <Card className="cpos-rule-panel" size="small" title="Кодын шатлал">
                <Tree
                    blockNode
                    selectedKeys={selectedRule.length >= 4 ? [selectedRule] : []}
                    treeData={codeTreeData}
                    loadData={loadCodeTreeNode}
                    onSelect={(keys) => setSelectedRule(String(keys[0] || "all"))}
                />
            </Card>
            <Card
                className="cpos-code-panel"
                size="small"
                title={(
                    <Space wrap>
                        <Text strong>{selectedRuleName}</Text>
                        <Tag color="blue">{filteredCodes.length.toLocaleString()} код</Tag>
                    </Space>
                )}
                extra={(
                    <Space wrap>
                        <Button
                            type={measurementStatus === "mapped" ? "primary" : "default"}
                            onClick={() => setMeasurementStatus((current) => (
                                current === "mapped" ? "all" : "mapped"
                            ))}
                        >
                            Оруулсан / зассан ({mappedCodeCount.toLocaleString()})
                        </Button>
                        <Button
                            type={measurementStatus === "unmapped" ? "primary" : "default"}
                            onClick={() => setMeasurementStatus((current) => (
                                current === "unmapped" ? "all" : "unmapped"
                            ))}
                        >
                            Оруулаагүй ({(codes.length - mappedCodeCount).toLocaleString()})
                        </Button>
                        <Input
                            allowClear
                            prefix={<SearchOutlined />}
                            placeholder="Код, нэр, марк, зургийн дугаар, нэгж, баркодоор хайх"
                            value={codeSearch}
                            onChange={(event) => setCodeSearch(event.target.value)}
                            style={{ width: 360, maxWidth: "42vw" }}
                        />
                    </Space>
                )}
            >
                <Table
                    size="middle"
                    columns={codeColumns}
                    dataSource={filteredCodes}
                    rowKey="__rowKey"
                    rowClassName={(record) => (
                        hasMeasurementMapping(record.no) ? "measurement-audited-row" : ""
                    )}
                    scroll={{ x: 1250, y: 560 }}
                    pagination={{
                        current: codePage,
                        pageSize: codePageSize,
                        pageSizeOptions: [20, 50, 100, 200],
                        showSizeChanger: true,
                        showQuickJumper: true,
                        position: ["bottomCenter"],
                        showTotal: (total, range) => `${range[0]}–${range[1]} / ${total.toLocaleString()} код`,
                        onChange: (page, pageSize) => {
                            setCodePage(pageSize === codePageSize ? page : 1);
                            setCodePageSize(pageSize);
                        },
                    }}
                    locale={{ emptyText: <Empty description="Код олдсонгүй" /> }}
                />
            </Card>
        </div>
        </>
    );

    const unitView = (
        <Card
            size="small"
            title={<Text strong>Хэмжих нэгжийн жагсаалт</Text>}
            extra={(
                <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="Хэмжих нэгж хайх"
                    value={unitSearch}
                    onChange={(event) => setUnitSearch(event.target.value)}
                    style={{ width: 280 }}
                />
            )}
        >
            <Table
                size="middle"
                rowKey={(record) => String(record.id)}
                dataSource={filteredUnits}
                columns={[
                    { title: "ID", dataIndex: "id", key: "id", width: 120, align: "center" },
                    { title: "Хэмжих нэгжийн нэр", dataIndex: "name", key: "name" },
                ]}
                pagination={false}
                locale={{ emptyText: <Empty description="Хэмжих нэгж олдсонгүй" /> }}
            />
        </Card>
    );

    return (
        <div className="measure-units-page">
            <div className="measure-units-header">
                <div>
                    <Title level={3}>Барааны код ба хэмжих нэгж</Title>
                    <Text type="secondary">CPOS ангиллын дагуу барааны код, марк, баркод болон хэмжих нэгжийг харах.</Text>
                </div>
                <Space size={18} wrap>
                    <Button
                        type="primary"
                        icon={<BarChartOutlined />}
                        onClick={() => setReportOpen(true)}
                        disabled={loading || !codes.length}
                    >
                        Тайлан
                    </Button>
                    <Statistic title="Ангилал" value={rules.length} />
                    <Statistic title="Барааны код" value={codes.length} groupSeparator="," />
                    <Statistic title="Хэмжих нэгж" value={units.length} />
                </Space>
            </div>

            {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 14 }} />}
            <Spin spinning={loading} tip="CPOS мэдээлэл уншиж байна...">
                <Tabs
                    defaultActiveKey="codes"
                    items={[
                        { key: "codes", label: "Ангилал ба барааны код", children: codeView },
                        { key: "units", label: `Хэмжих нэгж (${units.length})`, children: unitView },
                    ]}
                />
            </Spin>
            <MeasurementReport
                open={reportOpen}
                onClose={() => setReportOpen(false)}
                codes={codes}
                rules={rules}
                units={units}
                measurementRecords={measurementRecords}
            />
            <Modal
                title="Хэмжих нэгж олноор оруулах"
                open={bulkImportOpen}
                width={760}
                destroyOnHidden
                okText={`Хадгалах (${bulkImportPreview.rows.length})`}
                cancelText="Цуцлах"
                okButtonProps={{
                    disabled: !bulkImportPreview.rows.length || bulkImportPreview.errors.length > 0,
                    loading: bulkImporting,
                }}
                onOk={importMeasurements}
                onCancel={() => {
                    if (!bulkImporting) setBulkImportOpen(false);
                }}
            >
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Alert
                        showIcon
                        type="info"
                        message="Excel-ээс Код болон Хэмжих нэгж гэсэн 2 баганыг шууд хуулж оруулна уу."
                        description="13 оронтой кодын эхний 0 автоматаар сэргээгдэнэ. Давхардсан кодыг нэг удаа хадгална."
                    />
                    <Input.TextArea
                        value={bulkImportText}
                        onChange={(event) => setBulkImportText(event.target.value)}
                        placeholder={"1010101002001\tКилограмм\n2010101002001\tШирхэг"}
                        autoSize={{ minRows: 8, maxRows: 16 }}
                    />
                    {bulkImportPreview.duplicateCount > 0 && (
                        <Alert
                            showIcon
                            type="warning"
                            message={`${bulkImportPreview.duplicateCount} давхардсан мөр нэгтгэгдлээ`}
                        />
                    )}
                    {bulkImportPreview.errors.length > 0 && (
                        <Alert
                            showIcon
                            type="error"
                            message={`${bulkImportPreview.errors.length} алдаа байна`}
                            description={bulkImportPreview.errors.slice(0, 8).map((item) => (
                                <div key={item}>{item}</div>
                            ))}
                        />
                    )}
                    {bulkImportPreview.rows.length > 0 && (
                        <Table
                            size="small"
                            rowKey="code"
                            pagination={false}
                            dataSource={bulkImportPreview.rows.slice(0, 8)}
                            columns={[
                                { title: "Код", dataIndex: "code", width: 160 },
                                {
                                    title: "Барааны нэр",
                                    render: (_, row) => normalize(row.record.name),
                                    ellipsis: true,
                                },
                                {
                                    title: "Хэмжих нэгж",
                                    render: (_, row) => `${row.unit.name} (${row.unit.id})`,
                                    width: 180,
                                },
                            ]}
                        />
                    )}
                </Space>
            </Modal>
        </div>
    );
};

export default MeasureUnits;
