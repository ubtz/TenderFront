import { useState } from "react";
import { Checkbox, Input, Space } from "antd";
import { LockOutlined } from "@ant-design/icons";
import PropTypes from "prop-types";

const { TextArea } = Input;
const RETURN_COMMENT_MAX_LENGTH = 1000;
const returnCommentReasons = [
    "Өөр өөр багцад хамаарах бараа материалыг нэг багцад оруулсан",
    "Багцад бараа материалыг бүрэн оруулаагүй",
    "Тоо хэмжээ зөрүүтэй",
    "Нэгж үнэ зөрүүтэй",
    "Техникийн тодорхойлолт алдаатай",
    "Төсөв алдаатай",
    "Тендер амжилтгүй болсон",
    "НХ руу илгээх ёсгүй багц үүсгэж илгээсэн",
    "Шаардагдах огноо тендер зохион байгуулах хугацаатай нийцэхгүй байна",
];

const ReturnOrderForm = ({ onValuesChange }) => {
    const [selectedReasons, setSelectedReasons] = useState([]);
    const [additionalComment, setAdditionalComment] = useState("");
    const [cancel, setCancel] = useState(false);
    const reasonsLength = selectedReasons.join("; ").length;
    const separatorLength = selectedReasons.length && additionalComment ? 2 : 0;
    const totalLength = reasonsLength + separatorLength + additionalComment.length;
    const additionalMaxLength = Math.max(
        0,
        RETURN_COMMENT_MAX_LENGTH - reasonsLength - (selectedReasons.length ? 2 : 0)
    );

    const notifyChange = (nextReasons, nextComment, nextCancel) => {
        onValuesChange({
            selectedReasons: nextReasons,
            additionalComment: nextComment,
            cancel: nextCancel,
        });
    };

    return (
        <Space direction="vertical" size={16} className="return-order-form">
            <div className="return-order-heading">
                <div className="return-order-heading__title">Буцаах шалтгаан</div>
                <div className="return-order-heading__hint">Нэг эсвэл хэд хэдэн шалтгаан сонгож болно.</div>
            </div>
            <Checkbox.Group
                className="return-reason-group"
                value={selectedReasons}
                onChange={(values) => {
                    const nextReasonsLength = values.join("; ").length;
                    const nextCommentMaxLength = Math.max(
                        0,
                        RETURN_COMMENT_MAX_LENGTH - nextReasonsLength - (values.length ? 2 : 0)
                    );
                    const nextComment = additionalComment.slice(0, nextCommentMaxLength);
                    setSelectedReasons(values);
                    setAdditionalComment(nextComment);
                    notifyChange(values, nextComment, cancel);
                }}
            >
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    {returnCommentReasons.map((reason) => (
                        <Checkbox key={reason} value={reason} className="return-reason-option">
                            {reason}
                        </Checkbox>
                    ))}
                </Space>
            </Checkbox.Group>
            <TextArea
                rows={3}
                className="return-order-comment"
                placeholder="Нэмэлт тайлбар бичих (заавал биш)"
                value={additionalComment}
                maxLength={additionalMaxLength}
                showCount={{
                    formatter: () => `${totalLength} / ${RETURN_COMMENT_MAX_LENGTH}`,
                }}
                onChange={(event) => {
                    const nextComment = event.target.value;
                    setAdditionalComment(nextComment);
                    notifyChange(selectedReasons, nextComment, cancel);
                }}
            />
            <div className="return-permanent-action">
                <div className="return-permanent-action__header">
                    <LockOutlined /> Цуцлах
                </div>
                <Checkbox
                    className="return-permanent-action__checkbox"
                    checked={cancel}
                    onChange={(event) => {
                        const nextCancel = event.target.checked;
                        setCancel(nextCancel);
                        notifyChange(selectedReasons, additionalComment, nextCancel);
                    }}
                >
                    Захиалгыг дахин засварлах болон ашиглах боломжгүй болгох
                </Checkbox>
                <div className="return-permanent-action__warning">
                    Үүнийг сонговол захиалгыг засварлан дахин илгээх боломжгүй. Зөвхөн захиалгыг бүр мөсөн хаах шаардлагатай үед сонгоно уу.
                </div>
            </div>
        </Space>
    );
};

ReturnOrderForm.propTypes = {
    onValuesChange: PropTypes.func.isRequired,
};

export default ReturnOrderForm;
