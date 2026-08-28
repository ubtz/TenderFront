import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Checkbox, Input, Modal, Space, Steps, Table, Tag, Tooltip, Typography, message } from "antd";
import { CheckOutlined, FolderOpenOutlined, ReloadOutlined, RetweetOutlined, SearchOutlined } from "@ant-design/icons";
import axios from "axios";
import PropTypes from "prop-types";

const { Text } = Typography;
const API_BASE_URL = import.meta.env.VITE_API_URL;

const unwrap = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return value;
  for (const key of ["String", "Int64", "Float64", "Time"]) {
    if (value[key] !== undefined && value[key] !== null) return unwrap(value[key]);
  }
  return "";
};
const normalize = (value) => String(unwrap(value) ?? "").trim();
const toNumber = (value) => Number(normalize(value).replace(/,/g, "")) || 0;
const normalizeDate = (value) => normalize(value).split(/[T ]/)[0].replace(/-/g, "/");
const getItemId = (item) => item.basket_item_id ?? item.BasketItemId ?? item.id;

const buildPackageTree = (items) => {
  const baskets = new Map();
  items.forEach((item, index) => {
    const basketId = normalize(item.basket_id);
    const basketName = normalize(item.basket_name) || "Нэргүй багц";
    const basketKey = `basket:${basketId || basketName}`;
    if (!baskets.has(basketKey)) {
      baskets.set(basketKey, { key: basketKey, type: "basket", basketId, basketName, codes: new Map() });
    }

    const basketEntry = baskets.get(basketKey);
    const code = normalize(item.code) || "Кодгүй";
    const codeIdentity = code === "Кодгүй" ? `${code}-${getItemId(item) || index}` : code;
    const codeKey = `${basketKey}:code:${codeIdentity}`;
    if (!basketEntry.codes.has(codeKey)) {
      basketEntry.codes.set(codeKey, {
        key: codeKey,
        type: "code",
        code,
        name: normalize(item.cr4name) || "Нэргүй бараа",
        mark: normalize(item.crmarkname),
        brand: normalize(item.crbrandname),
        unit: normalize(item.mname || item.usize),
        quantity: 0,
        unitPrice: toNumber(item.price),
        basketItemIds: [],
        sourceItems: [],
      });
    }

    const codeEntry = basketEntry.codes.get(codeKey);
    codeEntry.quantity += toNumber(item.qty);
    codeEntry.sourceItems.push(item);
    const itemId = getItemId(item);
    if (itemId !== null && itemId !== undefined) codeEntry.basketItemIds.push(Number(itemId));
  });

  return [...baskets.values()].map((entry) => ({
    key: entry.key,
    type: entry.type,
    basketId: entry.basketId,
    basketName: entry.basketName,
    children: [...entry.codes.values()],
  }));
};

const getCodeRows = (tree) => tree.flatMap((pkg) => pkg.children || []);

const buildPayload = (basketTree, selectedKeySet) => {
  const packages = new Map();
  let tailbar = "";
  getCodeRows(basketTree).forEach((code) => {
    if (!selectedKeySet.has(code.key)) return;
    code.sourceItems.forEach((item) => {
      if (!tailbar) tailbar = normalize(item.tailbar || item.Tailbar);
      const pkgno = normalize(item.pkgno);
      const pkgdate = normalizeDate(item.pkgdate);
      const pkgname = normalize(item.pkgname);
      const packageKey = `${pkgno}|${pkgdate}|${pkgname}`;
      if (!packages.has(packageKey)) {
        packages.set(packageKey, {
          pkgno,
          pkgdate,
          pkgname,
          codes: new Map(),
        });
      }
      const pkg = packages.get(packageKey);
      if (!pkg.codes.has(code.code)) {
        pkg.codes.set(code.code, {
          code: code.code,
        });
      }
    });
  });

  return {
    tailbar,
    packages: [...packages.values()].map((pkg) => ({
      pkgno: pkg.pkgno,
      pkgdate: pkg.pkgdate,
      pkgname: pkg.pkgname,
      codes: [...pkg.codes.values()],
    })),
  };
};

const TenderReannounceModal = ({ open, record, onClose, onArchived }) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedCodeKeys, setSelectedCodeKeys] = useState([]);
  const [expandedPackageKeys, setExpandedPackageKeys] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const packageTree = useMemo(() => buildPackageTree(items), [items]);
  const codeRows = useMemo(() => getCodeRows(packageTree), [packageTree]);
  const selectedKeySet = useMemo(() => new Set(selectedCodeKeys), [selectedCodeKeys]);
  const recycleCount = selectedCodeKeys.length;
  const recycleTree = useMemo(() => packageTree.flatMap((basket) => {
    const children = basket.children.filter((code) => selectedKeySet.has(code.key));
    return children.length ? [{ ...basket, children }] : [];
  }), [packageTree, selectedKeySet]);
  const preparedPayload = useMemo(
    () => buildPayload(packageTree, selectedKeySet),
    [packageTree, selectedKeySet]
  );

  const filteredTree = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    if (!query) return packageTree;
    return packageTree.flatMap((pkg) => {
      const packageMatches = [pkg.basketName]
        .some((value) => normalize(value).toLocaleLowerCase().includes(query));
      if (packageMatches) return [pkg];
      const children = pkg.children.filter((code) => [code.code, code.name, code.mark, code.brand]
        .some((value) => normalize(value).toLocaleLowerCase().includes(query)));
      return children.length ? [{ ...pkg, children }] : [];
    });
  }, [packageTree, searchText]);

  const loadItems = async () => {
    if (!record?.basket_ids) return;
    setLoading(true);
    try {
      const ids = Array.isArray(record.basket_ids) ? record.basket_ids.join(",") : record.basket_ids;
      const response = await axios.get(`${API_BASE_URL}/get/GetBasketItemsById/${ids}`);
      const nextItems = response.data || [];
      const nextTree = buildPackageTree(nextItems);
      setItems(nextItems);
      setSelectedCodeKeys([]);
      setExpandedPackageKeys(nextTree.map((pkg) => pkg.key));
    } catch (error) {
      console.error("Tender reannounce items fetch failed:", error);
      message.error("Тендерийн захиалгуудыг уншиж чадсангүй");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadItems();
    else {
      setItems([]);
      setSelectedCodeKeys([]);
      setExpandedPackageKeys([]);
      setSearchText("");
      setCurrentStep(0);
    }
  }, [open, record?.basket_ids]);

  const toggleCode = (key, checked) => {
    setSelectedCodeKeys((current) => checked
      ? [...new Set([...current, key])]
      : current.filter((entry) => entry !== key));
  };

  const togglePackage = (pkg, checked) => {
    const packageKeys = new Set(pkg.children.map((code) => code.key));
    setSelectedCodeKeys((current) => {
      const next = new Set(current);
      packageKeys.forEach((key) => checked ? next.add(key) : next.delete(key));
      return [...next];
    });
  };

  const submitReannounce = async () => {
    if (recycleCount <= 0) {
      message.warning("Дахин зарлах дор хаяж нэг захиалга сонгоно уу");
      return;
    }
    console.log("[Tender reannounce] submit payload", preparedPayload);
    setSubmitting(true);
    try {
      const archiveCurrent = selectedCodeKeys.length === codeRows.length;
      const response = await axios.post(
        `${API_BASE_URL}/post/ReannounceTender/${record?.tender_id}?archive=${archiveCurrent}`,
        preparedPayload
      );
      console.log("[Tender reannounce] response", response.data);
      message.success(response.data?.message || "Тендер дахин зарлах дараалалд амжилттай орлоо");
      onArchived?.(response.data);
    } catch (error) {
      console.error("Tender reannounce failed:", error?.response?.data || error);
      message.error(error?.response?.data?.error || "Тендер дахин зарлахад алдаа гарлаа");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: "Багц / Захиалга",
      key: "structure",
      width: 430,
      render: (_, row) => row.type === "basket" ? (
        <Space size={9}>
          <span className="tender-reannounce-package-icon"><FolderOpenOutlined /></span>
          <Space direction="vertical" size={1}>
            <Text strong>{row.basketName}</Text>
            <Text type="secondary">Багцын захиалгууд · {row.children.length} нэгтгэсэн захиалга</Text>
          </Space>
        </Space>
      ) : (
        <Space direction="vertical" size={1}>
          <Text code>{row.code}</Text>
          <Text strong>{row.name}</Text>
        </Space>
      ),
    },
    {
      title: "Марк / Брэнд",
      key: "product",
      render: (_, row) => row.type === "code"
        ? <Text>{[row.mark, row.brand].filter(Boolean).join(" · ") || "—"}</Text>
        : null,
    },
    {
      title: "Тоо",
      dataIndex: "quantity",
      key: "quantity",
      width: 105,
      align: "right",
      render: (value, row) => row.type === "code" ? toNumber(value).toLocaleString() : null,
    },
    {
      title: "Нэгж үнэ",
      dataIndex: "unitPrice",
      key: "unitPrice",
      width: 135,
      align: "right",
      render: (value, row) => row.type === "code" ? `${toNumber(value).toLocaleString()} ₮` : null,
    },
    {
      title: <Tooltip title="Чагталсан код дахин зарлагдана"><RetweetOutlined /></Tooltip>,
      key: "decision",
      width: 58,
      align: "center",
      render: (_, row) => {
        if (row.type === "basket") {
          const selectedCount = row.children.filter((code) => selectedKeySet.has(code.key)).length;
          return (
            <Tooltip title="Багцын бүх кодыг сонгох">
              <Checkbox
                checked={selectedCount === row.children.length && row.children.length > 0}
                indeterminate={selectedCount > 0 && selectedCount < row.children.length}
                onChange={(event) => togglePackage(row, event.target.checked)}
              />
            </Tooltip>
          );
        }
        return (
          <Tooltip title={selectedKeySet.has(row.key) ? "Дахин зарлана" : "Гэрээ үүсгэх шатанд үргэлжилнэ"}>
            <Checkbox checked={selectedKeySet.has(row.key)} onChange={(event) => toggleCode(row.key, event.target.checked)} />
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Modal
      open={open}
      title={<span className="tender-reannounce-title"><RetweetOutlined /> Тендер дахин зарлах</span>}
      width={1120}
      centered
      destroyOnHidden
      onCancel={onClose}
      closable={!submitting}
      maskClosable={!submitting}
      className="tender-reannounce-modal"
      footer={currentStep === 0 ? [
        <Button key="cancel" onClick={onClose}>Болих</Button>,
        <Button key="next" type="primary" onClick={() => setCurrentStep(1)} disabled={recycleCount === 0}>
          Дараах
        </Button>,
      ] : currentStep === 1 ? [
        <Button key="back" onClick={() => setCurrentStep(0)}>Буцах</Button>,
        <Button key="next" type="primary" onClick={() => setCurrentStep(2)}>Body шалгах</Button>,
      ] : [
        <Button key="back" onClick={() => setCurrentStep(1)} disabled={submitting}>Буцах</Button>,
        <Button key="prepare" type="primary" danger icon={<RetweetOutlined />} loading={submitting} onClick={submitReannounce}>Дахин зарлахыг батлах</Button>,
      ]}
    >
      <Steps
        current={currentStep}
        size="small"
        className="tender-reannounce-steps"
        items={[
          { title: "Үр дүн сонгох", description: "Үлдэх захиалга" },
          { title: "Дахин зарлах", description: "Багц, код шалгах" },
          { title: "Body бэлтгэх", description: "API-д бэлэн болгох" },
        ]}
      />
      <div className="tender-reannounce-intro">
        <div>
          <Text strong>{currentStep === 0 ? "1. Багцын захиалга бүрийг шалгах" : currentStep === 1 ? "2. Дахин зарлах захиалгыг баталгаажуулах" : "3. API body-г шалгаж бэлтгэх"}</Text>
          <Text type="secondary">
            {currentStep === 0
              ? "Чагталсан захиалга дахин зарлагдана. Чагтлаагүй захиалга гэрээ үүсгэх шатанд үргэлжилнэ."
              : currentStep === 1
                ? "Энд зөвхөн дахин зарлагдах багц болон нэгтгэсэн кодууд харагдана."
                : "Баталсны дараа одоогийн тендер түүхэд хадгалагдаж, гадаад системийн мэдээлэл хүлээнэ."}
          </Text>
        </div>
        <Tag bordered={false}>API холбогдоогүй</Tag>
      </div>

      <div className="tender-reannounce-summary">
        <div><span>Багц</span><strong>{packageTree.length}</strong></div>
        <div><span>Нийт захиалга</span><strong>{codeRows.length}</strong></div>
        <div className="is-success"><span>Гэрээ үүсгэх</span><strong>{codeRows.length - selectedCodeKeys.length}</strong></div>
        <div className="is-recycle"><span>Дахин зарлах</span><strong>{recycleCount}</strong></div>
      </div>

      {currentStep === 0 && (
        <>
          <div className="tender-reannounce-toolbar">
            <Input allowClear prefix={<SearchOutlined />} placeholder="Багц, захиалга, код, марк, брэндээр хайх..." value={searchText} onChange={(event) => setSearchText(event.target.value)} />
            <Space wrap>
              <Button icon={<RetweetOutlined />} onClick={() => setSelectedCodeKeys(codeRows.map((code) => code.key))}>Бүгдийг дахин зарлах</Button>
              <Button icon={<CheckOutlined />} onClick={() => setSelectedCodeKeys([])}>Бүгдийг гэрээ рүү үлдээх</Button>
              <Button icon={<ReloadOutlined />} onClick={loadItems} loading={loading}>Шинэчлэх</Button>
            </Space>
          </div>
          {recycleCount > 0 && <Alert type="warning" showIcon message={`${recycleCount} захиалга дахин зарлах хэсэгт орно`} className="tender-reannounce-warning" />}
          <Table
            loading={loading}
            rowKey="key"
            columns={columns}
            dataSource={filteredTree}
            pagination={false}
            scroll={{ y: 430, x: 900 }}
            expandable={{ expandedRowKeys: expandedPackageKeys, onExpandedRowsChange: setExpandedPackageKeys, indentSize: 24 }}
            rowClassName={(row) => row.type === "basket" ? "is-package" : selectedKeySet.has(row.key) ? "is-recycle" : "is-success"}
          />
        </>
      )}

      {currentStep === 1 && (
        <Table
          rowKey="key"
          columns={columns.filter((column) => column.key !== "decision")}
          dataSource={recycleTree}
          pagination={false}
          scroll={{ y: 460, x: 840 }}
          expandable={{ defaultExpandAllRows: true, indentSize: 24 }}
          rowClassName={(row) => row.type === "basket" ? "is-package" : "is-recycle"}
        />
      )}

      {currentStep === 2 && (
        <div className="tender-reannounce-payload">
          <Alert type="info" showIcon message={`${preparedPayload.packages.length} эх багц API body-д бэлтгэгдлээ`} />
          <pre>{JSON.stringify(preparedPayload, null, 2)}</pre>
        </div>
      )}
    </Modal>
  );
};

TenderReannounceModal.propTypes = {
  open: PropTypes.bool.isRequired,
  record: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onArchived: PropTypes.func,
};

export default TenderReannounceModal;
