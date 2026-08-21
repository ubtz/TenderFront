// src/pages/Tender/TenderSuspendModal.jsx
import React from "react";
import { Modal, DatePicker } from "antd";

const TenderSuspendModal = ({
  visible,
  date,
  onDateChange,
  onOk,
  onCancel,
}) => {
  return (
    <Modal
      title="Түтгэлзүүлэх огноо оруулах"
      open={visible}
      onOk={onOk}
      onCancel={onCancel}
      okText="Хадгалах"
      cancelText="Болих"
      okButtonProps={{ danger: true, disabled: !date }}
      destroyOnHidden
    >
      <DatePicker
        showTime
        style={{ width: "100%" }}
        value={date}
        onChange={onDateChange}
      />
    </Modal>
  );
};

export default TenderSuspendModal;
