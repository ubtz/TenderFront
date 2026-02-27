// src/pages/Tender/TenderProgress.jsx
import React, { useMemo } from "react";
import { Progress, Button } from "antd";
import dayjs from "dayjs";
import { calcCompletion } from "./tender.utils";

const isEmpty = (val) => {
    if (val === null || val === "" || val === undefined || val === 0) return true;
    if (typeof val === "string" && val.startsWith("1900-01-01")) return true;
    return false;
};


const TenderProgress = ({ record, user, onSuspend }) => {
    const isUdirdlaga =
        user?.erh === "Удирдлага" || user?.Erh === "Удирдлага";

    const tenderType = record["тендерийн_төрөл"]?.trim();
    const mode = ["НТШ", "ХА"].includes(tenderType) ? "default" : "zuk";

    const percent = useMemo(
        () => calcCompletion(record, mode),
        [record, mode]
    );

    const end = dayjs(record["тендер_хаах_огноо"]);
    const isExpired = end.isValid() && end.isBefore(dayjs());

    return (
        <div
            style={{ minWidth: 160 }}
            onClick={(e) => e.stopPropagation()}
        >
            <Progress percent={percent} size="small" />

            {!isUdirdlaga && percent < 100 && (
                <Button
                    danger
                    size="small"
                    style={{ marginTop: 6 }}
                    disabled={isExpired}
                    onClick={() => onSuspend(record)}
                >
                    Түдгэлзүүлэх
                </Button>
            )}
        </div>
    );
};

export default TenderProgress;
