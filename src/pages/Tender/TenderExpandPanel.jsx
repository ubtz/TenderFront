import React from "react";
import {
    Descriptions,
    Input,
    DatePicker,
    Checkbox,
    Button,
} from "antd";
import dayjs from "dayjs";
import BasketItemsDetails from "../Бүртгэл/BasketItemsDetails";
import { isEmpty } from "./tender.utils";

const fieldLabels = {
    шалгаруулалтын_төрөл: "Шалгаруулалтын төрөл",
    тендерийн_төрөл: "Тендерийн төрөл",
    батлагдсан_төсөвт_өртөг: "Батлагдсан төсөв",
    тендер_нээх_огноо: "Тендер нээх огноо",
    тендер_хаах_огноо: "Тендер хаах огноо",
    тайлбар: "Тайлбар",
};

const TenderExpandPanel = ({ record, user, onUpdate }) => {
    const isUdirdlaga =
        user?.erh === "Удирдлага" || user?.Erh === "Удирдлага";

    const renderField = (field, type = "text") => {
        const value = record[field];

        if (isUdirdlaga) {
            if (type === "date" || type === "datetime") {
                return value ? dayjs(value).format("YYYY-MM-DD") : "";
            }
            return value || "";
        }

        if (type === "date") {
            return isEmpty(value) ? (
                <DatePicker
                    onChange={(d) =>
                        onUpdate(
                            record.tender_id,
                            field,
                            d ? d.format("YYYY-MM-DD") : ""
                        )
                    }
                />
            ) : (
                dayjs(value).format("YYYY-MM-DD")
            );
        }

        if (type === "checkbox") {
            return isEmpty(value) ? (
                <Checkbox
                    onChange={(e) =>
                        onUpdate(record.tender_id, field, e.target.checked)
                    }
                >
                    Сонгох
                </Checkbox>
            ) : value ? (
                "✅ Тийм"
            ) : (
                "❌ Үгүй"
            );
        }

        return isEmpty(value) ? (
            <Input
                placeholder={`${fieldLabels[field]} оруулах`}
                onBlur={(e) =>
                    onUpdate(record.tender_id, field, e.target.value.trim())
                }
                onPressEnter={(e) =>
                    onUpdate(record.tender_id, field, e.target.value.trim())
                }
            />
        ) : (
            value
        );
    };

    const fields = [
        "шалгаруулалтын_төрөл",
        "тендерийн_төрөл",
        "батлагдсан_төсөвт_өртөг",
        "тендер_нээх_огноо",
        "тендер_хаах_огноо",
        "тайлбар",
    ];

    return (
        <div style={{ padding: 12, background: "#fafafa" }}>
            <Descriptions bordered size="small" column={1}>
                {fields.map((field) => {
                    const type = field.includes("огноо") ? "date" : "text";

                    return (
                        <Descriptions.Item
                            key={field}
                            label={fieldLabels[field] || field}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                }}
                            >
                                <div style={{ flex: 1 }}>
                                    {renderField(field, type)}
                                </div>

                                {!isUdirdlaga && !isEmpty(record[field]) && (
                                    <Button
                                        type="text"
                                        danger
                                        size="small"
                                        onClick={() =>
                                            onUpdate(record.tender_id, field, "")
                                        }
                                    >
                                        Засах
                                    </Button>
                                )}
                            </div>
                        </Descriptions.Item>
                    );
                })}
            </Descriptions>

            {/* Захиалгууд */}
            {record.basket_ids && (
                <div style={{ marginTop: 16 }}>
                    <BasketItemsDetails basketIds={record.basket_ids} />
                </div>
            )}
        </div>
    );
};

export default TenderExpandPanel;
