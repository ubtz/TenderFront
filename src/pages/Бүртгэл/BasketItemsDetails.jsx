import { useCallback, useEffect, useRef, useState } from "react";
import { Table, Spin, message, Input, InputNumber, DatePicker, Progress, Button, Tag, Typography } from "antd";
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    DeleteOutlined,
    DownOutlined,
    InboxOutlined,
    PlusOutlined,
    RightOutlined,
    SearchOutlined,
    ShoppingCartOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import PropTypes from "prop-types";
import { getStoredUser } from "../../api/session";
import { createDebouncedSaveQueue } from "../../utils/debouncedSaveQueue";
import "./BasketItemsDetails.css";

const { Text } = Typography;
const API_BASE_URL = import.meta.env.VITE_API_URL;
const toNumber = (value) => Number(String(value ?? "").replace(/,/g, "")) || 0;
const parseArrivalList = (value) => {
    try {
        const parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};
const getArrivedQuantity = (item) => parseArrivalList(item?.tailbar).reduce(
    (sum, arrival) => sum + Math.max(0, toNumber(arrival?.qty)),
    0
);
const isFullyArrived = (item) => {
    const orderedQuantity = Math.max(0, toNumber(item?.qty));
    return orderedQuantity > 0 && getArrivedQuantity(item) >= orderedQuantity;
};
const calculateArrivalPercent = (arrivalItems) => {
    const orderedQuantity = arrivalItems.reduce(
        (sum, item) => sum + Math.max(0, toNumber(item.qty)),
        0
    );
    const arrivedQuantity = arrivalItems.reduce(
        (sum, item) => sum + Math.min(
            Math.max(0, toNumber(item.qty)),
            getArrivedQuantity(item)
        ),
        0
    );
    return orderedQuantity > 0
        ? Math.min(100, Math.round((arrivedQuantity / orderedQuantity) * 100))
        : 0;
};

const formatCposCode = (value) => {
    const code = String(value || "").trim().replace(/-/g, "");
    if (!/^\d{14}$/.test(code)) return String(value || "").trim() || "-";
    return code.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})(\d{3})$/, "$1-$2-$3-$4-$5-$6");
};

const bundleItemsByCode = (items) => {
    const groups = new Map();
    items.forEach((item, index) => {
        const code = String(item.code || "").trim();
        const key = code ? `code-${code}` : `item-${item.basket_item_id || index}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    });

    return [...groups.entries()].map(([key, sourceItems]) => ({
        ...sourceItems[0],
        key,
        qty: sourceItems.reduce((sum, item) => sum + toNumber(item.qty), 0),
        price: toNumber(sourceItems[0]?.price),
        departments: [...new Set(sourceItems.map((item) => String(item.dname || "").trim()).filter(Boolean))],
        packageNames: [...new Set(sourceItems
            .map((item) => String(item.pkgname || item.pkgno || "").trim())
            .filter(Boolean))],
        source_count: sourceItems.length,
        source_items: sourceItems,
    }));
};

const BasketItemsDetails = ({ basketIds, mode, includeReturned = false, onArrivalProgressChange, itemScrollY }) => {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [branches, setBranches] = useState([]);
    const [expandedRowKeys, setExpandedRowKeys] = useState([]);
    const [basketSearches, setBasketSearches] = useState({});
    const arrivalSaves = useRef(null);
    if (!arrivalSaves.current) {
        arrivalSaves.current = createDebouncedSaveQueue({
            save: (payload) => axios.put(`${API_BASE_URL}/put/basketitem/state`, payload),
            onError: (error) => {
                console.error("❌ Failed to update arrivals:", error);
                message.error("Ирсэн мэдээллийг хадгалж чадсангүй");
            },
        });
    }

    const user = getStoredUser();
    const isUdirdlaga =
        user?.erh?.toLowerCase() === "удирдлага";

    // ✅ Fetch branches once
    useEffect(() => {
        const fetchBranches = async () => {
            const cached = sessionStorage.getItem("branches");
            if (cached) return setBranches(JSON.parse(cached));

            try {
                const res = await axios.get(`${API_BASE_URL}/get/branches`);
                setBranches(res.data || []);
                sessionStorage.setItem("branches", JSON.stringify(res.data || []));
            } catch (err) {
                console.error("❌ Branches fetch error:", err);
            }
        };
        fetchBranches();
    }, []);


    // ✅ Helper: map shortName to "service (shortName)"
    const getServiceByShortName = (shortName) => {
        const branch = branches.find((b) => b.shortName === shortName);
        return branch ? `${branch.service} (${branch.shortName})` : shortName;
    };

    const fetchBasketItems = useCallback(async (ids) => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/get/GetBasketItemsById/${ids}`, {
                params: includeReturned ? { includeReturned: true } : undefined,
            });
            setItems(res.data || []);
            console.log("✅ Fetched basket items:", res.data);
        } catch (err) {
            console.error("❌ Error fetching basket items:", err);
            message.error("Сагсны өгөгдөл авахад алдаа гарлаа.");
        }
        setLoading(false);
    }, [includeReturned]);

    useEffect(() => {
        if (!basketIds?.length) {
            setItems([]);
            return;
        }
        fetchBasketItems(Array.isArray(basketIds) ? basketIds.join(",") : basketIds);
    }, [basketIds, fetchBasketItems]);

    useEffect(() => {
        const saves = arrivalSaves.current;
        return () => { void saves.flush(); };
    }, []);

    useEffect(() => {
        if (mode === "geree" && items.length > 0 && onArrivalProgressChange) {
            onArrivalProgressChange(calculateArrivalPercent(items));
        }
    }, [items, mode, onArrivalProgressChange]);

    const updateArrivalList = useCallback((record, newList) => {
        const tailbar = JSON.stringify(newList);
        const nextRecord = { ...record, tailbar };
        const arrived = isFullyArrived(nextRecord);
        setItems((current) => current.map((item) =>
            item.basket_item_id === record.basket_item_id
                ? { ...item, tailbar, isArrived: arrived }
                : item
        ));

        arrivalSaves.current.schedule(record.basket_item_id, {
            basket_item_id: record.basket_item_id,
            tailbar,
            isArrived: arrived,
        });
    }, []);

    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "400px",
                }}
            >
                <Spin size="large" />
                <span style={{ marginLeft: 10 }}>Түр хүлээнэ үү...</span>
            </div>
        );
    }

    if (!items.length)
        return <div style={{ padding: 10 }}>Сагсны мэдээлэл олдсонгүй.</div>;

    // ✅ Group items by basket_id
    const groupedByBasket = items.reduce((acc, item) => {
        if (!acc[item.basket_id]) acc[item.basket_id] = [];
        acc[item.basket_id].push(item);
        return acc;
    }, {});

    // ✅ Prepare table data (add total qty + total price)
    const tableData = Object.keys(groupedByBasket).map((basketId) => {
        const group = groupedByBasket[basketId];
        const bundledItems = mode === "geree"
            ? group.map((item) => ({ ...item, key: item.basket_item_id }))
            : bundleItemsByCode(group);
        const totalQty = group.reduce((sum, it) => sum + Number(it.qty || 0), 0);
        const totalPrice = group.reduce(
            (sum, it) => sum + Number(it.qty || 0) * Number(it.price || 0),
            0
        );
        return {
            key: basketId,
            basket_id: basketId,
            basket_name: group[0]?.basket_name || "-",
            count: bundledItems.length,
            source_count: group.length,
            total_qty: totalQty,
            total_price: totalPrice,
            items: group,
            bundled_items: bundledItems,
        };
    });
    const workspaceSummary = tableData.reduce(
        (summary, basket) => ({
            itemCount: summary.itemCount + basket.count,
            totalQty: summary.totalQty + basket.total_qty,
            totalPrice: summary.totalPrice + basket.total_price,
        }),
        { itemCount: 0, totalQty: 0, totalPrice: 0 }
    );

    const handleRowClick = (record) => {
        setExpandedRowKeys((prev) =>
            prev.includes(record.key)
                ? prev.filter((k) => k !== record.key)
                : [...prev, record.key]
        );
    };

    // ✅ Main basket columns
    const basketColumns = [
        {
            title: "Багцны нэр",
            dataIndex: "basket_name",
            key: "basket_name",
            render: (name, record) => (
                <div className="basket-items-package-name">
                    <span className="basket-items-package-name__icon"><InboxOutlined /></span>
                    <span>
                        <Text strong>{name}</Text>
                        <small>Багц #{record.basket_id}</small>
                    </span>
                </div>
            ),
        },
        {
            title: "Захиалга",
            dataIndex: "count",
            key: "count",
            align: "center",
            render: (value) => <Tag bordered={false} color="blue">{value} захиалга</Tag>,
        },
        {
            title: "Нийт тоо хэмжээ",
            dataIndex: "total_qty",
            key: "total_qty",
            align: "right",
            render: (v) => (v ? v.toLocaleString() : "0"),
        },
        {
            title: "Нийт үнэ",
            dataIndex: "total_price",
            key: "total_price",
            align: "right",
            render: (value) => value.toLocaleString() + " ₮",
        },
    ];

    // ✅ Add “Ирсэн %” column only in “geree” mode
    if (mode === "geree") {
        basketColumns.push({
            title: "Ирсэн %",
            key: "arrivedPercent",
            align: "center",
            render: (_, record) => <b>{calculateArrivalPercent(record.items || [])}%</b>,
        });
    }

    // ✅ Item-level columns
    const itemColumns = [
        {
            title: "Хаанаас",
            dataIndex: "dname",
            key: "dname",
            render: (value) => {
                if (!value) return "-";
                const formatted = getServiceByShortName(value);
                return <span>{formatted}</span>;
            },
        },
        { title: "Хэмжих нэгж", dataIndex: "mname", key: "mname", width: 90 },
        {
            title: "Код",
            dataIndex: "code",
            key: "code",
            width: 145,
            render: formatCposCode,
        },
        {
            title: "Нэр",
            dataIndex: "cr4name",
            key: "cr4name",
            render: (value, record) => (
                <span className="basket-items-product-name">
                    <span>{value || "-"}</span>
                    {record.source_count > 1 && <Tag color="green">{record.source_count} нэгтгэсэн</Tag>}
                </span>
            ),
        },
        { title: "Марк", dataIndex: "crmarkname", key: "crmarkname" },
        { title: "Брэнд", dataIndex: "crbrandname", key: "crbrandname", width: 120 },
        {
            title: "Тоо хэмжээ",
            dataIndex: "qty",
            key: "qty",
            width: 90,
            align: "right",
            render: (v) => v?.toLocaleString(),
        },
        {
            title: "Үнэ",
            dataIndex: "price",
            key: "price",
            align: "right",
            render: (v) => (v != null ? v.toLocaleString() + " ₮" : ""),
        },
        {
            title: "Нийт үнэ",
            key: "pricesum",
            align: "right",
            render: (_, record) =>
                (Number(record.qty || 0) * Number(record.price || 0)).toLocaleString() + " ₮",
        },
    ];

    // ✅ Extra editable columns (only for geree mode, not for удирдлага)
    if (mode === "geree") {
        itemColumns.push({
                title: "Хүлээн авалт",
                dataIndex: "tailbar",
                key: "arrival",
                width: 350,
                render: (value, record) => {
                    const arrivalList = parseArrivalList(value);
                    const orderedQuantity = Math.max(0, toNumber(record.qty));
                    const totalArrived = getArrivedQuantity(record);
                    const percent = orderedQuantity > 0
                        ? Math.min(100, Math.round((totalArrived / orderedQuantity) * 100))
                        : 0;
                    const fullyArrived = isFullyArrived(record);
                    const statusText = fullyArrived
                        ? "Бүрэн ирсэн"
                        : totalArrived > 0
                            ? "Хэсэгчлэн ирсэн"
                            : "Ирээгүй";

                    const addNew = () => updateArrivalList(record, [
                        ...arrivalList,
                        { qty: 0, date: dayjs().format("YYYY-MM-DD") },
                    ]);

                    const updateField = (idx, key, value) => {
                        const newList = arrivalList.map((a, i) =>
                            i === idx ? { ...a, [key]: value } : a
                        );
                        updateArrivalList(record, newList);
                    };

                    const removeField = (idx) =>
                        updateArrivalList(record, arrivalList.filter((_, i) => i !== idx));

                    return (
                        <div className={`arrival-editor ${fullyArrived ? "arrival-editor--complete" : ""}`}>
                            <div className="arrival-editor__summary">
                                <span className="arrival-editor__status">
                                    {fullyArrived ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                                    {statusText}
                                </span>
                                <strong>{totalArrived.toLocaleString()} / {orderedQuantity.toLocaleString()}</strong>
                            </div>
                            <Progress
                                percent={percent}
                                showInfo={false}
                                size="small"
                                strokeColor={fullyArrived ? "#4f9a73" : "#5c8fa8"}
                                trailColor="#e7eef1"
                            />
                            {arrivalList.map((a, idx) => (
                                <div key={`${idx}-${a.date || "new"}`} className="arrival-editor__entry">
                                    <span className="arrival-editor__entry-number">{idx + 1}</span>
                                    <InputNumber
                                        size="small"
                                        min={0}
                                        value={a.qty}
                                        placeholder="Тоо"
                                        disabled={isUdirdlaga}
                                        onChange={(quantity) => updateField(idx, "qty", Number(quantity || 0))}
                                    />
                                    <DatePicker
                                        size="small"
                                        value={a.date && dayjs(a.date).isValid() ? dayjs(a.date) : null}
                                        format="YYYY/MM/DD"
                                        placeholder="Огноо"
                                        disabled={isUdirdlaga}
                                        onChange={(date) => updateField(
                                            idx,
                                            "date",
                                            date ? date.format("YYYY-MM-DD") : null
                                        )}
                                    />
                                    {!isUdirdlaga && (
                                        <Button
                                            type="text"
                                            danger
                                            size="small"
                                            icon={<DeleteOutlined />}
                                            aria-label="Ирэлтийн мөр устгах"
                                            onClick={() => removeField(idx)}
                                        />
                                    )}
                                </div>
                            ))}
                            {!arrivalList.length && (
                                <div className="arrival-editor__empty">Ирсэн тоо, огноо бүртгэгдээгүй</div>
                            )}
                            {!isUdirdlaga && (
                                <Button
                                    block
                                    size="small"
                                    type="dashed"
                                    icon={<PlusOutlined />}
                                    className="arrival-editor__add"
                                    onClick={addNew}
                                >
                                    {arrivalList.length ? "Дахин ирэлт нэмэх" : "Ирэлт бүртгэх"}
                                </Button>
                            )}
                        </div>
                    );
                },
            });
    }


    // ✅ Expanded row
    const expandedRowRender = (record) => {
        const search = basketSearches[record.key] || "";
        const keywords = search.trim().toLocaleLowerCase("mn-MN").split(/\s+/).filter(Boolean);
        const filteredItems = record.bundled_items.filter((item) => {
            const searchableText = [item, ...(item.source_items || [])].flatMap((source) => [
                source.cr4name, source.code, formatCposCode(source.code), source.crmarkname,
                source.crbrandname, source.dname, getServiceByShortName(source.dname),
                source.pkgname, source.pkgno, source.mname,
            ]).filter(Boolean).join(" ").toLocaleLowerCase("mn-MN");
            return keywords.every((keyword) => searchableText.includes(keyword));
        });
        return (
        <div className="basket-items-expanded">
            <div className="basket-items-expanded__header">
                <div className="basket-items-expanded__title">
                    <ShoppingCartOutlined /> <strong title={record.basket_name}>{record.basket_name}</strong>
                    <span> багцын захиалгууд</span>
                </div>
                <div className="basket-items-search-toolbar" onClick={(event) => event.stopPropagation()}>
                <Input
                    size="small"
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="Нэр, код, марк, брэнд, захиалагчаар хайх"
                    aria-label={`${record.basket_name} багцын захиалга хайх`}
                    value={search}
                    onChange={(event) => setBasketSearches((previous) => ({
                        ...previous, [record.key]: event.target.value,
                    }))}
                />
                <Text type="secondary">{filteredItems.length} / {record.count} захиалга</Text>
                </div>
            </div>
            <Table
                className="basket-items-detail-table"
                columns={itemColumns}
                dataSource={filteredItems}
                locale={{ emptyText: "Хайлтад тохирох захиалга олдсонгүй" }}
                expandable={mode === "geree" ? undefined : {
                    rowExpandable: (item) => item.source_count > 1,
                    expandedRowRender: (item) => (
                        <div className="basket-items-source-list">
                            {item.source_items.map((source) => (
                                <div key={source.basket_item_id}>
                                    <span>{getServiceByShortName(source.dname) || "-"}</span>
                                    <span>{source.pkgname || source.pkgno || "-"}</span>
                                    <strong>{toNumber(source.qty).toLocaleString()} × {toNumber(source.price).toLocaleString()} ₮</strong>
                                </div>
                            ))}
                        </div>
                    ),
                }}
                pagination={false}
                size="small"
                scroll={{ x: 1200, y: itemScrollY }}
            />
        </div>
        );
    };

    return (
        <div className="basket-items-workspace">
            <div className="basket-items-summary">
                <div><span>Багц</span><strong>{tableData.length}</strong></div>
                <div><span>Захиалга</span><strong>{workspaceSummary.itemCount}</strong></div>
                <div><span>Нийт тоо</span><strong>{workspaceSummary.totalQty.toLocaleString()}</strong></div>
                <div className="basket-items-summary__amount">
                    <span>Нийт үнэ</span>
                    <strong>{workspaceSummary.totalPrice.toLocaleString()} ₮</strong>
                </div>
            </div>
            <Table
                className="basket-items-group-table"
                columns={basketColumns}
                dataSource={tableData}
                expandable={{
                    expandedRowRender,
                    rowExpandable: (record) => record.items?.length > 0,
                    expandedRowKeys,
                    expandIcon: ({ expanded, onExpand, record }) => (
                        <Button
                            type="text"
                            shape="circle"
                            className="basket-items-expand-button"
                            icon={expanded ? <DownOutlined /> : <RightOutlined />}
                            onClick={(event) => {
                                event.stopPropagation();
                                onExpand(record, event);
                            }}
                        />
                    ),
                    onExpand: (expanded, record) => {
                        setExpandedRowKeys((prev) =>
                            expanded
                                ? [...prev, record.key]
                                : prev.filter((k) => k !== record.key)
                        );
                    },
                }}
                onRow={(record) => ({
                    onClick: () => handleRowClick(record),
                    className: expandedRowKeys.includes(record.key)
                        ? "basket-items-parent-row--expanded"
                        : "",
                })}
                rowKey="key"
                pagination={false}
                size="middle"
                tableLayout="fixed"
            />
        </div>
    );
};

BasketItemsDetails.propTypes = {
    basketIds: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
    mode: PropTypes.string,
    includeReturned: PropTypes.bool,
    onArrivalProgressChange: PropTypes.func,
    itemScrollY: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

export default BasketItemsDetails;
