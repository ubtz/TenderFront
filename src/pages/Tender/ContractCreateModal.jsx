import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, DatePicker, Descriptions, Empty, Form, Input, InputNumber, Modal, Select, Space, Spin, Upload, message } from "antd";
import axios from "axios";
import dayjs from "dayjs";
import PropTypes from "prop-types";

const getErrorMessage = (error) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  "Гэрээ үүсгэхэд алдаа гарлаа";

const formatContractAmount = (value) => {
  const [integerPart, decimalPart] = String(value ?? "").replace(/'/g, "").split(".");
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return decimalPart === undefined ? formattedInteger : `${formattedInteger}.${decimalPart}`;
};

const parseContractAmount = (value) => String(value ?? "").replace(/'/g, "");

const ContractCreateModal = ({ open, tender, existingContracts = [], excludedBasketIds = [], onCancel, onCreated }) => {
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const [form] = Form.useForm();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [loadingBaskets, setLoadingBaskets] = useState(false);
  const [basketOptions, setBasketOptions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [awardPdf, setAwardPdf] = useState(null);
  const companyRegister = Form.useWatch("companyRegister", form);

  const organizations = useMemo(() => {
    const values = String(tender?.Organization || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return [...new Set([...values, "НХ"])];
  }, [tender]);

  const tenderBasketIds = useMemo(() => {
    const values = Array.isArray(tender?.basket_ids)
      ? tender.basket_ids
      : String(tender?.basket_ids || "").split(",");
    return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
  }, [tender]);

  const contractedBasketIds = useMemo(() => new Set(
    existingContracts.flatMap((contract) => String(contract?.basket_ids || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean))
  ), [existingContracts]);

  const excludedBasketIdSet = useMemo(
    () => new Set(excludedBasketIds.map((value) => String(value).trim()).filter(Boolean)),
    [excludedBasketIds]
  );

  const availableTenderBasketIds = useMemo(
    () => tenderBasketIds.filter((basketId) => (
      !contractedBasketIds.has(basketId) && !excludedBasketIdSet.has(basketId)
    )),
    [contractedBasketIds, excludedBasketIdSet, tenderBasketIds]
  );

  useEffect(() => {
    if (!open || !tender) return;

    setAwardPdf(null);
    setBasketOptions([]);

    form.setFieldsValue({
      organization: organizations[0],
      contractDate: dayjs(),
      amount: Number(tender["батлагдсан_төсөвт_өртөг"]) || 0,
      currency: "MNT",
      companyRegister: tender.ААН_регистер || "",
      supplierName: tender.Бэлтгэн_нийлүүлэгч_ААН || "",
      basketIds: [],
    });

    const loadUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await axios.get(`${API_BASE_URL}/get/GetUsers`);
        setUsers(
          (Array.isArray(response.data) ? response.data : []).filter(
            (item) => item.erh === "Гэрээний мэргэжилтэн"
          )
        );
      } catch (error) {
        message.error(getErrorMessage(error));
      } finally {
        setLoadingUsers(false);
      }
    };

    const loadBaskets = async () => {
      if (!availableTenderBasketIds.length) return;
      try {
        setLoadingBaskets(true);
        const response = await axios.get(
          `${API_BASE_URL}/get/GetBasketItemsById/${availableTenderBasketIds.join(",")}`
        );
        const grouped = new Map(availableTenderBasketIds.map((basketId) => [basketId, {
          value: basketId,
          name: `Багц #${basketId}`,
          orderCount: 0,
        }]));

        (Array.isArray(response.data) ? response.data : []).forEach((item) => {
          const basketId = String(item.basket_id ?? "").trim();
          if (!basketId || !grouped.has(basketId)) return;
          const current = grouped.get(basketId);
          grouped.set(basketId, {
            ...current,
            name: String(item.basket_name || "").trim() || current.name,
            orderCount: current.orderCount + 1,
          });
        });

        const options = [...grouped.values()];
        setBasketOptions(options);
        form.setFieldValue("basketIds", options.map((item) => item.value));
      } catch (error) {
        setBasketOptions(availableTenderBasketIds.map((basketId) => ({
          value: basketId,
          name: `Багц #${basketId}`,
          orderCount: 0,
        })));
        form.setFieldValue("basketIds", availableTenderBasketIds);
        message.error(error?.response?.data?.error || "Багцны мэдээлэл татахад алдаа гарлаа");
      } finally {
        setLoadingBaskets(false);
      }
    };

    loadUsers();
    loadBaskets();
  }, [API_BASE_URL, availableTenderBasketIds, form, open, organizations, tender]);

  const lookupCompany = async () => {
    const register = String(form.getFieldValue("companyRegister") || "").trim();
    if (!register) {
      form.setFields([{ name: "companyRegister", errors: ["ААН регистер оруулна уу"] }]);
      return;
    }

    try {
      setLoadingCompany(true);
      const response = await axios.post(`${API_BASE_URL}/external/orders/client`, {
        Value: register,
      });
      const companyName = String(response.data?.message || "").trim();

      if (!response.data?.status || !companyName || companyName === "Not found!") {
        form.setFieldValue("supplierName", "");
        message.warning("ААН олдсонгүй");
        return;
      }

      form.setFieldsValue({ companyRegister: register, supplierName: companyName });
      message.success(`ААН олдлоо: ${companyName}`);
    } catch (error) {
      form.setFieldValue("supplierName", "");
      message.error(getErrorMessage(error));
    } finally {
      setLoadingCompany(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!awardPdf) {
        message.warning("Гэрээ байгуулах эрх олгосон PDF хавсаргана уу");
        return;
      }
      setSubmitting(true);

      const payload = {
        TenderId: tender.tender_id,
        Гэрээ_байгуулсан_огноо: values.contractDate.toISOString(),
        Гэрээ_байгуулсан_ААН: values.organization,
        Бэлтгэн_нийлүүлэгч_ААН: String(values.supplierName || "").trim(),
        ААН_регистер: String(values.companyRegister || "").trim(),
        Хүчинтэй_хугацаа: tender.Хүчинтэй_хугацаа || "",
        Валют: values.currency,
        Гэрээний_дүн: Number(values.amount) || 0,
        Төлбөрийн_нөхцөл: tender.Төлбөрийн_нөхцөл || "",
        Төлбөрийн_огноо: tender.Төлбөрийн_огноо || null,
        Төлбөр_хийх_хугацаа: tender.Төлбөр_хийх_хугацаа || null,
        Нийлүүлэх_нөхцөл: tender.Нийлүүлэх_нөхцөл || "",
        Нийлүүлэх_хугацаа: tender.Нийлүүлэх_хугацаа || null,
        Алдангийн_нөхцөл: tender.Алдангийн_нөхцөл || "",
        Гэрээ_хэрэгжилтийн_явц: "",
        Тодруулга: "",
        Дүгнэлт: "",
        Санамж: "",
        Гэрээний_төлөв: "ШИНЭ",
        BasketIds: values.basketIds.join(","),
        GereeUserId: values.specialistId,
      };

      const formData = new FormData();
      formData.append("contract", JSON.stringify(payload));
      formData.append("awardPdf", awardPdf);
      const response = await axios.post(`${API_BASE_URL}/post/PostGeree`, formData);
      message.success(response.data?.message || "Гэрээ амжилттай үүсгэгдлээ");
      form.resetFields();
      setAwardPdf(null);
      onCreated(tender.tender_id);
    } catch (error) {
      if (error?.errorFields) return;
      message.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Гэрээ үүсгэх"
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText="Гэрээ үүсгэх"
      cancelText="Болих"
      confirmLoading={submitting}
      destroyOnHidden
      width={720}
    >
      <section className="tender-contract-source">
        <div className="tender-contract-source__title">Үндсэн мэдээлэл</div>
        <Descriptions
          size="small"
          column={2}
          items={[
            { key: "number", label: "Тендерийн дугаар", children: tender?.тендерийн_дугаар || "—" },
            { key: "name", label: "Тендерийн нэр", children: tender?.tender_name || "—", span: 2 },
            { key: "type", label: "Тендерийн төрөл", children: tender?.тендерийн_төрөл || "—" },
            {
              key: "budget",
              label: "Төсөвт өртөг",
              children: `${Number(tender?.["батлагдсан_төсөвт_өртөг"] || 0).toLocaleString()} ₮`,
            },
          ]}
        />
      </section>

      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item
          name="basketIds"
          label="Багцны нэр"
          rules={[{
            type: "array",
            min: 1,
            required: true,
            message: "Гэрээнд оруулах багадаа нэг багц сонгоно уу",
          }]}
        >
          <Checkbox.Group className="tender-contract-baskets" disabled={loadingBaskets}>
            {loadingBaskets ? (
              <div className="tender-contract-baskets__loading"><Spin size="small" /> Багцуудыг уншиж байна...</div>
            ) : basketOptions.length ? (
              basketOptions.map((basket) => (
                <Checkbox key={basket.value} value={basket.value} className="tender-contract-basket-option">
                  <span className="tender-contract-basket-option__name">{basket.name}</span>
                  <span className="tender-contract-basket-option__count">
                    {basket.orderCount ? `${basket.orderCount} захиалга` : `Багц #${basket.value}`}
                  </span>
                </Checkbox>
              ))
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Сонгох багц олдсонгүй" />
            )}
          </Checkbox.Group>
        </Form.Item>

        <Form.Item
          name="specialistId"
          label="Гэрээний мэргэжилтэн"
          rules={[{ required: true, message: "Мэргэжилтэн сонгоно уу" }]}
        >
          <Select
            loading={loadingUsers}
            showSearch
            optionFilterProp="label"
            placeholder="Мэргэжилтэн сонгох"
            options={users.map((item) => ({
              value: item.id,
              label: `${item.ovog || ""} ${item.ner || ""}`.trim() || item.username,
            }))}
            notFoundContent={loadingUsers ? "Уншиж байна..." : "Мэргэжилтэн олдсонгүй"}
          />
        </Form.Item>

        <Form.Item
          name="companyRegister"
          label="ААН регистер (сонголттой)"
          rules={[
            { max: 30, message: "ААН регистер 30 тэмдэгтээс урт байж болохгүй" },
          ]}
        >
          <Space.Compact style={{ width: "100%" }}>
            <Input
              allowClear
              placeholder="Гэрээ байгуулах ААН-ийн регистр"
              onChange={() => form.setFieldValue("supplierName", "")}
              onPressEnter={(event) => {
                event.preventDefault();
                lookupCompany();
              }}
            />
            <Button
              type="primary"
              loading={loadingCompany}
              disabled={!String(companyRegister || "").trim()}
              onClick={lookupCompany}
            >
              Хайх
            </Button>
          </Space.Compact>
        </Form.Item>

        <Form.Item
          name="supplierName"
          label="Бэлтгэн нийлүүлэгч ААН"
        >
          <Input readOnly placeholder="Одоо хайх эсвэл гэрээний бүртгэлээс дараа бөглөнө" />
        </Form.Item>

        <Form.Item
          name="organization"
          label="Гэрээ үүсгэх байгууллага"
          rules={[{ required: true, message: "Байгууллага сонгоно уу" }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={organizations.map((item) => ({ value: item, label: item }))}
          />
        </Form.Item>

        <div className="tender-contract-grid">
          <Form.Item
            name="contractDate"
            label="Гэрээ байгуулсан огноо"
            rules={[{ required: true, message: "Огноо сонгоно уу" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="amount" label="Гэрээний дүн">
            <InputNumber
              stringMode
              min="0"
              precision={2}
              controls={false}
              style={{ width: "100%" }}
              formatter={formatContractAmount}
              parser={parseContractAmount}
            />
          </Form.Item>
          <Form.Item name="currency" label="Валют (сонголттой)">
            <Select
              allowClear
              placeholder="Валют сонгох"
              options={[
                { value: "MNT", label: "MNT — Төгрөг" },
                { value: "USD", label: "USD — Ам.доллар" },
                { value: "RUB", label: "RUB — Рубль" },
                { value: "CNY", label: "CNY — Юань" },
              ]}
            />
          </Form.Item>
        </div>
        <Form.Item label="Гэрээ байгуулах эрх олгосон (PDF)" required>
          <Upload
            accept=".pdf,application/pdf"
            maxCount={1}
            fileList={awardPdf ? [{ uid: awardPdf.uid, name: awardPdf.name, status: "done" }] : []}
            beforeUpload={(file) => {
              if (!file.name.toLowerCase().endsWith(".pdf") || file.size > 20 * 1024 * 1024) {
                message.error("Зөвхөн 20 МБ хүртэлх PDF файл сонгоно уу");
                return Upload.LIST_IGNORE;
              }
              setAwardPdf(file);
              return false;
            }}
            onRemove={() => setAwardPdf(null)}
          >
            <Button>PDF сонгох (20 МБ хүртэл)</Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
  );
};

ContractCreateModal.propTypes = {
  open: PropTypes.bool.isRequired,
  tender: PropTypes.object,
  existingContracts: PropTypes.arrayOf(PropTypes.object),
  excludedBasketIds: PropTypes.arrayOf(PropTypes.string),
  onCancel: PropTypes.func.isRequired,
  onCreated: PropTypes.func.isRequired,
};

export default ContractCreateModal;
