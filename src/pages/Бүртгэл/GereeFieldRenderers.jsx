// src/pages/Geree/GereeFieldRenderers.jsx
import React from "react";
import { Input, InputNumber, Select, DatePicker, Progress, Button, message } from "antd";
import dayjs from "dayjs";
import axios from "axios";

const currencyOptions = [
  { label: "₮ MNT", value: "MNT" },
  { label: "$ USD", value: "USD" },
  { label: "€ EUR", value: "EUR" },
  { label: "¥ CNY", value: "CNY" },
  { label: "₽ RUB", value: "RUB" },
];

export const calcCompletion = (record) => {
  const fields = Object.keys(record).filter(
    (f) => !["GereeId", "TenderId", "CreatedAt"].includes(f)
  );
  let filled = 0;
  fields.forEach((f) => {
    if (record[f] && record[f] !== "0") filled++;
  });
  return Math.round((filled / fields.length) * 100);
};

export const ProgressAction = ({ record }) => {
  const percent = calcCompletion(record);
  return (
    <div style={{ textAlign: "center" }}>
      <Progress percent={percent} size="small" />
    </div>
  );
};

export const fieldLabels = {
  гэрээний_дугаар: "Гэрээний дугаар",
  гэрээ_байгуулсан_огноо: "Гэрээ байгуулсан огноо",
  гэрээ_байгуулсан_ААН: "Худалдан авагч УБТЗ-ын ААН",
  ААН_регистер: "ААН регистер",
  хүчинтэй_хугацаа: "Хүчинтэй хугацаа",
  валют: "Валют",
  гэрээний_дүн: "Гэрээний дүн",
  төлбөрийн_нөхцөл: "Төлбөрийн нөхцөл",
  төлбөрийн_огноо: "Төлбөрийн огноо",
  төлбөр_хийх_хугацаа: "Төлбөр хийх хугацаа",
  нийлүүлэх_нөхцөл: "Нийлүүлэх нөхцөл",
  нийлүүлэх_хугацаа: "Нийлүүлэх хугацаа",
  алдангийн_нөхцөл: "Алдангийн нөхцөл",
  гэрээ_хэрэгжилтийн_явц: "Гэрээ хэрэгжилтийн явц",
  тодруулга: "Тодруулга",
  дүгнэлт: "Дүгнэлт",
  санамж: "Санамж",
  гэрээний_төлөв: "Гэрээний төлөв",
  бэлтгэн_нийлүүлэгч_ААН: "Бэлтгэн нийлүүлэгч ААН",
};

export const renderField = (record, field, type, user, handleUpdate, fetchClientInfo) => {
  const value = record[field];
  const isUdir = user?.erh === "Удирдлага" || user?.Erh === "Удирдлага";

  // === ААН регистер ===
  if (field === "ААН_регистер") {
    return isUdir ? (
      value || ""
    ) : (
      <Input
        placeholder="ААН регистер оруулах"
        defaultValue={value}
        onPressEnter={async (e) => {
          const reg = e.target.value.trim();
          if (!reg) return;
          await handleUpdate(record.GereeId, field, reg);
          const clientData = await fetchClientInfo(reg);
          if (clientData?.status) {
            await handleUpdate(record.GereeId, "бэлтгэн_нийлүүлэгч_ААН", clientData.message);
          } else {
            message.error("ААН олдсонгүй");
          }
        }}
      />
    );
  }

  // === Гэрээний дүн ===
  if (field === "гэрээний_дүн") {
    if (value) return `${Number(value).toLocaleString()}`;
    return isUdir ? (
      "-"
    ) : (
      <InputNumber
        style={{ width: "100%" }}
        placeholder="дүн оруулах"
        onBlur={(e) => handleUpdate(record.GereeId, field, e.target.value)}
      />
    );
  }

  // === Валют ===
  if (field === "Валют" || field === "валют") {
    return isUdir ? (
      value || "-"
    ) : (
      <Select
        style={{ width: "100%" }}
        placeholder="Валют сонгох"
        defaultValue={value}
        options={currencyOptions}
        onChange={(val) => handleUpdate(record.GereeId, field, val)}
      />
    );
  }

  // === Date ===
  if (type === "date") {
    return value ? (
      dayjs(value).format("YYYY-MM-DD")
    ) : isUdir ? (
      "-"
    ) : (
      <DatePicker
        style={{ width: "100%" }}
        onChange={(date) =>
          handleUpdate(record.GereeId, field, date.format("YYYY-MM-DD"))
        }
      />
    );
  }

  // === Datetime ===
  if (type === "datetime") {
    return value ? (
      dayjs(value).format("YYYY-MM-DD HH:mm:ss")
    ) : isUdir ? (
      "-"
    ) : (
      <DatePicker
        showTime
        style={{ width: "100%" }}
        onChange={(date) =>
          handleUpdate(record.GereeId, field, date.format("YYYY-MM-DD HH:mm:ss"))
        }
      />
    );
  }

  // === Default text ===
  return isUdir ? (
    value || "-"
  ) : (
    <Input
      placeholder={`${field} оруулах`}
      defaultValue={value}
      onBlur={(e) => handleUpdate(record.GereeId, field, e.target.value)}
    />
  );
};
