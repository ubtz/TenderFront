import { useState, useEffect } from "react";
import { Button, Modal, Space, Tooltip, Form, Input, message } from "antd";
import { PrinterFilled, MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import axios from "axios";
import { getStoredUser } from "../../api/session";
import { buildPlanPrintDocument, execTeamFormValues, execTeamPayload } from "./printDocument";

pdfMake.addVirtualFileSystem(pdfFonts.vfs || pdfFonts);

const PrintIcon = ({ normData, planId, UserId }) => {
  const [open, setOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamLoadFailed, setTeamLoadFailed] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const user = getStoredUser();
  const ownerId = UserId ?? normData?.user_id;
  const canEdit = Number(ownerId) > 0 && Number(user?.id) === Number(ownerId)
    && user?.erh?.toLowerCase() !== "удирдлага";

  const handlePrint = () => {
    setTeamLoading(true);
    setTeamLoadFailed(false);
    setIsModalVisible(true);
  };

  const handleOk = async () => {
    if (loading || teamLoading || teamLoadFailed) return;
    try {
      const values = canEdit ? await form.validateFields() : form.getFieldsValue();
      const payload = execTeamPayload(values, planId, ownerId);
      // Validate the document before saving the approval information.
      const document = buildPlanPrintDocument(normData, payload);
      setLoading(true);
      if (canEdit) {
        await axios.post(`${API_BASE_URL}/post/PostExecTeam`, payload);
        message.success("Батлах ажилтны мэдээлэл хадгалагдлаа");
      }
      pdfMake.createPdf(document).getDataUrl((dataUrl) => {
        setPdfUrl(dataUrl);
        setOpen(true);
        setIsModalVisible(false);
        setLoading(false);
      });
    } catch (error) {
      setLoading(false);
      if (error?.errorFields) return;
      console.error("Plan printing failed:", error);
      message.error(error.response?.data?.error || error.message || "Хэвлэхэд алдаа гарлаа");
    }
  };

  useEffect(() => {
    if (!isModalVisible) return;
    let cancelled = false;
    setTeamLoading(true);
    setTeamLoadFailed(false);
    form.resetFields();
    axios.get(`${API_BASE_URL}/get/GetExecTeam`)
      .then((response) => {
        if (cancelled) return;
        const teams = Array.isArray(response.data) ? response.data : [];
        const team = teams.find((entry) =>
          String(entry.planRootNumber ?? entry.PlanRootNumber) === String(planId)
          && Number(entry.userId ?? entry.UserId) === Number(ownerId)
        );
        form.setFieldsValue(execTeamFormValues(team));
      })
      .catch((error) => {
        if (cancelled) return;
        setTeamLoadFailed(true);
        console.error("Approval team fetch failed:", error);
        message.error("Батлах ажилтны мэдээлэл татаж чадсангүй. Дахин нээнэ үү");
      })
      .finally(() => { if (!cancelled) setTeamLoading(false); });
    return () => { cancelled = true; };
  }, [API_BASE_URL, form, isModalVisible, planId, ownerId]);

  return (
    <>
      <Tooltip title="Гүйцэтгэл хэвлэх">
        <Space>
          <PrinterFilled
            onClick={() => handlePrint()}
            style={{ fontSize: "20px", color: "#1e96fc", cursor: "pointer" }}
          />
        </Space>
        <Modal
          title="PDF Preview"
          open={open}
          onCancel={() => setOpen(false)}
          footer={null}
          width={1250}
        >
          {pdfUrl && <iframe title="Төлөвлөгөөний PDF" src={pdfUrl} width="100%" height="900px" />}
        </Modal>
      </Tooltip>
      <Modal
        title="Төлөвлөгөө батлах"
        open={isModalVisible}
        onOk={handleOk}
        confirmLoading={loading || teamLoading}
        okButtonProps={{ disabled: teamLoading || teamLoadFailed }}
        onCancel={() => setIsModalVisible(false)}
        okText="Баталгаажуулах"
        cancelText="Болих"
        width={700}
      >
        <Form form={form} layout="vertical" disabled={!canEdit || teamLoading || loading}>
          {/* Батлах ажилтан */}
          <h4>Батлах ажилтан:</h4>
          <Form.List name="Mod">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} align="baseline" style={{ display: "flex", marginBottom: 8 }}>
                    <Form.Item
                      {...restField}
                      name={[name, "label"]}
                      rules={[{ required: true, message: "Албан тушаал оруулна уу" }]}
                    >
                      <Input placeholder="Албан тушаал" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, "name"]}
                      rules={[{ required: true, message: "Овог нэр оруулна уу" }]}
                    >
                      <Input placeholder="Овог нэр" />
                    </Form.Item>
                    {canEdit && (
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{ color: "red", cursor: "pointer" }}
                      />
                    )}
                  </Space>
                ))}
                {canEdit && (
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Нэмэх
                    </Button>
                  </Form.Item>
                )}
              </>
            )}
          </Form.List>

          {/* Зөвшөөрсөн ажилтан */}
          <h4>Зөвшөөрсөн ажилтан:</h4>
          <Form.List name="approved">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} align="baseline" style={{ display: "flex", marginBottom: 8 }}>
                    <Form.Item {...restField} name={[name, "label"]}>
                      <Input placeholder="Албан тушаал" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, "name"]}>
                      <Input placeholder="Овог нэр" />
                    </Form.Item>
                    {canEdit && (
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{ color: "red", cursor: "pointer" }}
                      />
                    )}
                  </Space>
                ))}
                {canEdit && (
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Нэмэх
                    </Button>
                  </Form.Item>
                )}
              </>
            )}
          </Form.List>

          {/* Гүйцэтгэсэн ажилтан */}
          <h4>Гүйцэтгэсэн ажилтан:</h4>
          <Form.List name="executed">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} align="baseline" style={{ display: "flex", marginBottom: 8 }}>
                    <Form.Item {...restField} name={[name, "label"]}>
                      <Input placeholder="Албан тушаал" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, "name"]}>
                      <Input placeholder="Овог нэр" />
                    </Form.Item>
                    {canEdit && (
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{ color: "red", cursor: "pointer" }}
                      />
                    )}
                  </Space>
                ))}
                {canEdit && (
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Нэмэх
                    </Button>
                  </Form.Item>
                )}
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </>
  );
};
PrintIcon.propTypes = {
  // normId: PropTypes.number.isRequired, //  нормын ID
  // norm: PropTypes.object.isRequired, // Нормын дэлгэрэнгүй мэдээлэл

};
export default PrintIcon;
