import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Typography, message } from "antd";
import { CheckCircleOutlined, ReloadOutlined, RetweetOutlined } from "@ant-design/icons";
import axios from "axios";
import PropTypes from "prop-types";
import BasketItemsDetails from "../Бүртгэл/BasketItemsDetails";

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
const parseBasketIds = (value) => [...new Set(
  (Array.isArray(value) ? value : String(value || "").split(","))
    .map((item) => normalize(item))
    .filter(Boolean)
)];

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

const buildPayload = (basketTree, selectedKeySet, tailbar) => {
  const packages = new Map();
  getCodeRows(basketTree).forEach((code) => {
    if (!selectedKeySet.has(code.key)) return;
    code.sourceItems.forEach((item) => {
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
          basketIds: new Set(),
        });
      }
      const basketId = Number(item.basket_id);
      if (Number.isInteger(basketId) && basketId > 0) {
        pkg.codes.get(code.code).basketIds.add(basketId);
      }
    });
  });

  return {
    tailbar: normalize(tailbar),
    packages: [...packages.values()].map((pkg) => ({
      pkgno: pkg.pkgno,
      pkgdate: pkg.pkgdate,
      pkgname: pkg.pkgname,
      codes: [...pkg.codes.values()].map((code) => ({
        code: code.code,
        basketIds: [...code.basketIds],
      })),
    })),
  };
};

const TenderReannounceModal = ({ open, record, existingContracts = [], recycleBasketIds = [], onClose, onArchived }) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState([]);
  const [tailbar, setTailbar] = useState("");
  const tenderBasketIds = useMemo(() => parseBasketIds(record?.basket_ids), [record?.basket_ids]);
  const contractedBasketIds = useMemo(() => new Set(
    existingContracts.flatMap((contract) => parseBasketIds(contract?.basket_ids))
  ), [existingContracts]);
  const uncontractedBasketIds = useMemo(
    () => tenderBasketIds.filter((basketId) => !contractedBasketIds.has(basketId)),
    [contractedBasketIds, tenderBasketIds]
  );
  const requestedRecycleBasketIds = useMemo(
    () => new Set(recycleBasketIds.map((value) => normalize(value)).filter(Boolean)),
    [recycleBasketIds]
  );
  const availableBasketIds = useMemo(
    () => uncontractedBasketIds.filter((basketId) => (
      !requestedRecycleBasketIds.size || requestedRecycleBasketIds.has(basketId)
    )),
    [requestedRecycleBasketIds, uncontractedBasketIds]
  );
  const availableBasketKey = availableBasketIds.join(",");
  const packageTree = useMemo(() => buildPackageTree(items), [items]);
  const codeRows = useMemo(() => getCodeRows(packageTree), [packageTree]);
  const selectedKeySet = useMemo(() => new Set(codeRows.map((code) => code.key)), [codeRows]);
  const recycleCount = codeRows.length;
  const archiveCurrent = availableBasketIds.length > 0
    && availableBasketIds.length === uncontractedBasketIds.length;
  const preparedPayload = useMemo(
    () => buildPayload(packageTree, selectedKeySet, tailbar),
    [packageTree, selectedKeySet, tailbar]
  );

  const loadItems = useCallback(async () => {
    if (!availableBasketKey) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/get/GetBasketItemsById/${availableBasketKey}`);
      const nextItems = response.data || [];
      const existingTailbar = nextItems
        .map((item) => normalize(item.tailbar || item.Tailbar))
        .find(Boolean) || "";
      setItems(nextItems);
      setTailbar(existingTailbar);
    } catch (error) {
      console.error("Tender reannounce items fetch failed:", error);
      message.error("Тендерийн захиалгуудыг уншиж чадсангүй");
    } finally {
      setLoading(false);
    }
  }, [availableBasketKey]);

  useEffect(() => {
    if (open) loadItems();
    else {
      setItems([]);
      setTailbar("");
    }
  }, [loadItems, open]);

  const submitReannounce = async () => {
    if (recycleCount <= 0) {
      message.warning("Дахин зарлах дор хаяж нэг захиалга сонгоно уу");
      return;
    }
    if (!tailbar.trim()) {
      message.warning("Тайлбар оруулна уу");
      return;
    }
    console.log("[Tender reannounce] submit payload", preparedPayload);
    setSubmitting(true);
    try {
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

  return (
    <Modal
      open={open}
      title={<span className="tender-reannounce-title"><RetweetOutlined /> Дахин зарлах багцыг баталгаажуулах</span>}
      width="min(1500px, 96vw)"
      centered
      destroyOnHidden
      onCancel={onClose}
      closable={!submitting}
      maskClosable={!submitting}
      className="tender-reannounce-modal"
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>Болих</Button>,
        <Button
          key="submit"
          type="primary"
          danger
          icon={<RetweetOutlined />}
          loading={submitting}
          disabled={loading || recycleCount === 0 || !tailbar.trim()}
          onClick={submitReannounce}
        >
          {packageTree.length} багцыг дахин зарлах
        </Button>,
      ]}
    >
      <div className="tender-reannounce-layout">
        <section className="tender-reannounce-review">
          <div className="tender-reannounce-toolbar">
            <div>
              <Text strong>Захиалга</Text>
              <Text type="secondary">{packageTree.length} багц · {recycleCount} нэгтгэсэн захиалга</Text>
            </div>
            <Button icon={<ReloadOutlined />} onClick={loadItems} loading={loading}>Шинэчлэх</Button>
          </div>
          <BasketItemsDetails
            basketIds={availableBasketKey}
            sourceItems={items}
            loadingOverride={loading}
            itemScrollY="min(310px, 34vh)"
          />
        </section>

        <aside className="tender-reannounce-confirmation">
          <div className="tender-reannounce-checklist">
            <Text strong>Илгээх мэдээлэл</Text>
            <span><CheckCircleOutlined /> {packageTree.length} багц сонгогдсон</span>
            <span><CheckCircleOutlined /> {recycleCount} захиалга багтсан</span>
            <span><CheckCircleOutlined /> Багцын код, нэр, огноог хамт илгээнэ</span>
          </div>
          <div className="tender-reannounce-comment">
            <div>
              <Text strong>Дахин зарлах шалтгаан <Text type="danger">*</Text></Text>
              <Text type="secondary">Түүх болон буцаагдсан захиалгад харагдана.</Text>
            </div>
            <Input.TextArea
              value={tailbar}
              onChange={(event) => setTailbar(event.target.value)}
              placeholder="Жишээ: Техникийн шаардлага шинэчлэгдсэн тул дахин зарлана..."
              autoSize={{ minRows: 6, maxRows: 10 }}
              maxLength={1000}
              showCount
            />
          </div>
          <div className={`tender-reannounce-result ${archiveCurrent ? "is-waiting" : "is-partial"}`}>
            <strong>{archiveCurrent ? "Тендер хүлээлгийн төлөвт орно" : "Тендер идэвхтэй хэвээр үлдэнэ"}</strong>
            <span>{archiveCurrent
              ? "Гадаад системээс шинэ хувилбар ирэхийг хүлээнэ."
              : "Сонгогдоогүй багцуудаар гэрээ үүсгэх боломжтой."}</span>
          </div>
        </aside>
      </div>
    </Modal>
  );
};

TenderReannounceModal.propTypes = {
  open: PropTypes.bool.isRequired,
  record: PropTypes.object,
  existingContracts: PropTypes.arrayOf(PropTypes.object),
  recycleBasketIds: PropTypes.arrayOf(PropTypes.string),
  onClose: PropTypes.func.isRequired,
  onArchived: PropTypes.func,
};

export default TenderReannounceModal;
