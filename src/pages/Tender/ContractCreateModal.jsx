import { useEffect, useMemo, useState } from "react";
import { Button, DatePicker, Descriptions, Form, Input, InputNumber, Modal, Select, Space, message } from "antd";
import axios from "axios";
import dayjs from "dayjs";

const getErrorMessage = (error) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  "Гэрээ үүсгэхэд алдаа гарлаа";

const ContractCreateModal = ({ open, tender, onCancel, onCreated }) => {
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const [form] = Form.useForm();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const companyRegister = Form.useWatch("companyRegister", form);

  const organizations = useMemo(() => {
    const values = String(tender?.Organization || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return [...new Set([...values, "НХ"])];
  }, [tender]);

  useEffect(() => {
    if (!open || !tender) return;

    form.setFieldsValue({
      organization: organizations[0],
      contractNumber: `GR-${Date.now()}`,
      contractDate: dayjs(),
      amount: Number(tender["батлагдсан_төсөвт_өртөг"]) || 0,
      currency: "MNT",
      companyRegister: tender.ААН_регистер || "",
      supplierName: tender.Бэлтгэн_нийлүүлэгч_ААН || "",
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

    loadUsers();
  }, [API_BASE_URL, form, open, organizations, tender]);

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
      setSubmitting(true);

      const payload = {
        TenderId: tender.tender_id,
        Гэрээний_дугаар: values.contractNumber.trim(),
        Гэрээ_байгуулсан_огноо: values.contractDate.toISOString(),
        Гэрээ_байгуулсан_ААН: values.organization,
        Бэлтгэн_нийлүүлэгч_ААН: values.supplierName.trim(),
        ААН_регистер: values.companyRegister.trim(),
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
        BasketIds: tender.basket_ids || "",
        GereeUserId: values.specialistId,
      };

      const response = await axios.post(`${API_BASE_URL}/post/PostGeree`, payload);
      message.success(response.data?.message || "Гэрээ амжилттай үүсгэгдлээ");
      form.resetFields();
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
      width={620}
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
          label="ААН регистер"
          rules={[
            { required: true, whitespace: true, message: "ААН регистер оруулна уу" },
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
          rules={[{ required: true, whitespace: true, message: "ААН регистрээр хайж баталгаажуулна уу" }]}
        >
          <Input readOnly placeholder="ААН регистрээр хайхад автоматаар бөглөгдөнө" />
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
            name="contractNumber"
            label="Гэрээний дугаар"
            rules={[{ required: true, message: "Гэрээний дугаар оруулна уу" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="contractDate"
            label="Гэрээ байгуулсан огноо"
            rules={[{ required: true, message: "Огноо сонгоно уу" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="amount" label="Гэрээний дүн">
            <InputNumber min={0} controls={false} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="currency" label="Валют">
            <Select options={[{ value: "MNT", label: "MNT" }]} />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

export default ContractCreateModal;
