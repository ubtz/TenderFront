import React, { useState } from "react";
import { Form, Input, Button, Select, DatePicker, Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";

const { Option } = Select;

const Upload_Баримт = () => {
    const [fileList, setFileList] = useState([]);
    const [mainFileList, setMainFileList] = useState([]);
    const [attachmentFileList, setAttachmentFileList] = useState([]);
    const [additionalFileList, setAdditionalFileList] = useState([]);
    const API_BASE_URL = import.meta.env.VITE_API_URL
    const handleMainFileChange = ({ fileList }) => setMainFileList(fileList);
    const handleAttachmentFileChange = ({ fileList }) => setAttachmentFileList(fileList);
    const handleAdditionalFileChange = ({ fileList }) => setAdditionalFileList(fileList);
    const handleFileChange = (info) => {
        let newList = info.fileList.slice(-1);  // Limit to 1 file
        setFileList(newList);
    };
    const [form] = Form.useForm();
    const [typeValue, setTypeValue] = useState(null);

    // ✅ Default options
    const defaultApprovedBy = [
        "Н", "НЗ-1", "НГз", "НЗрб", "НЗд", "НЗт", "НЗп", "НЗуп",
        "НЗэф", "НЗс", "НЗи", "НХ",
    ];

    // ✅ Special options for "Бусад"
    const busadApprovedBy = [
        "УИХ-ын дарга", "МУ-ын Ерөнхий сайд", "Сангийн сайд",
        "ЗТ-ын сайд", "ЭЗХ-ийн сайд", "ГХ-ын сайд",
        "ХЗДХ-ийн сайд", "АҮЭБ-ын сайд", "ЗГХА-ийн дарга",
        "ИТХ-ын дарга", "Засаг дарга",
    ];

    const handleSubmit = async (values) => {
        if (mainFileList.length === 0) {
            message.error("Үндсэн файл сонгоно уу!");
        }
        const formData = new FormData();
        formData.append("group", values.group);
        formData.append("number", values.number);
        formData.append("name", values.name);
        formData.append("type", values.type);
        formData.append("approvedBy", values.approvedBy);

        if (values.approvedDate) {
            formData.append("approvedDate", values.approvedDate.format("YYYY-MM-DD"));
        }
        if (values.followDate) {
            formData.append("followDate", values.followDate.format("YYYY-MM-DD"));
        }
        mainFileList.forEach((file, idx) => {
            formData.append("main[]", file.originFileObj);
        });
        attachmentFileList.forEach((file, idx) => {
            formData.append("attachment[]", file.originFileObj);
        });
        additionalFileList.forEach((file, idx) => {
            formData.append("additional[]", file.originFileObj);
        });


        try {
            console.log("Submitting form data:", values);
            console.log("Main files:", mainFileList);
            console.log("Attachment files:", attachmentFileList);
            console.log("Additional files:", additionalFileList);

            const res = await fetch(`${API_BASE_URL}/post/upload`, {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (res.ok) {
                message.success(data.message || "Файл илгээгдлээ");

                form.resetFields(); // Clear input fields
                setMainFileList([]);
                setAttachmentFileList([]);
                setAdditionalFileList([]);
            }
            else {
                message.error(data.error || "Алдаа гарлаа");
            }
        } catch (err) {
            console.error(err);
            message.error("Сервертэй холбогдож чадсангүй");
        }
    };

    return (
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <h2>Баримт байршуулах</h2>
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Form.Item
                    label="Бүлэг"
                    name="group"
                    rules={[{ required: true, message: "Бүлэг сонгоно уу!" }]}
                >
                    <Select placeholder="Сонгох">
                        <Option value="Худалдан авалттай холбоотой">Худалдан авалттай холбоотой</Option>
                    </Select>
                </Form.Item>

                <div style={{ display: "flex", gap: "1rem" }}>
                    <Form.Item
                        label="Дугаар"
                        name="number"
                        style={{ flex: 1 }}
                        rules={[{ required: true, message: "Дугаар оруулна уу!" }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        label="Нэр"
                        name="name"
                        style={{ flex: 1 }}
                        rules={[{ required: true, message: "Нэр оруулна уу!" }]}
                    >
                        <Input />
                    </Form.Item>
                </div>

                <div style={{ display: "flex", gap: "1rem" }}>
                    <Form.Item
                        label="Төрөл"
                        name="type"
                        style={{ flex: 1 }}
                        rules={[{ required: true, message: "Төрөл оруулна уу!" }]}
                    >
                        <Select
                            placeholder="Сонгох"
                            onChange={(val) => setTypeValue(val)} // 👈 Save selected value
                        >
                            <Option value="Тушаал">Тушаал УБТЗ</Option>
                            <Option value="Цахилгаан">Цахилгаан</Option>
                            <Option value="Бусад">Тендер, Хууль эрх зүй</Option>
                        </Select>
                    </Form.Item>

                    {/* Баталсан */}
                    <Form.Item
                        label="Баталсан"
                        name="approvedBy"
                        style={{ flex: 1 }}
                        rules={[{ required: true, message: "Баталсан мэдээлэл оруулна уу!" }]}
                    >
                        <Select placeholder="Сонгох">
                            {(typeValue === "Бусад" ? busadApprovedBy : defaultApprovedBy).map(
                                (option) => (
                                    <Option key={option} value={option}>
                                        {option}
                                    </Option>
                                )
                            )}
                        </Select>
                    </Form.Item>
                </div>

                <div style={{ display: "flex", gap: "1rem" }}>
                    <Form.Item
                        label="Батлагдсан огноо"
                        name="approvedDate"
                        style={{ flex: 1 }}
                        rules={[{ required: true, message: "Батлагдсан огноо сонгоно уу!" }]}
                    >
                        <DatePicker style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item
                        label="Дагаж мөрдөх огноо"
                        name="followDate"
                        style={{ flex: 1 }}
                        rules={[{ required: true, message: "Дагаж мөрдөх огноо сонгоно уу!" }]}
                    >
                        <DatePicker style={{ width: "100%" }} />
                    </Form.Item>
                </div>

                <Form.Item label="Үндсэн файл">
                    <Upload
                        beforeUpload={() => false}
                        onChange={({ fileList }) => setMainFileList(fileList)}
                        fileList={mainFileList}
                        onRemove={file => setMainFileList(mainFileList.filter(f => f.uid !== file.uid))}
                        accept=".pdf"
                        multiple
                    >
                        <Button icon={<UploadOutlined />}>Үндсэн файл сонгох</Button>
                    </Upload>
                </Form.Item>

                <Form.Item label="Хавсралт файл">
                    <Upload
                        beforeUpload={() => false}
                        onChange={({ fileList }) => setAttachmentFileList(fileList)}
                        fileList={attachmentFileList}
                        onRemove={file => setAttachmentFileList(attachmentFileList.filter(f => f.uid !== file.uid))}
                        accept=".pdf"
                        multiple
                    >
                        <Button icon={<UploadOutlined />}>Хавсралт файл сонгох</Button>
                    </Upload>
                </Form.Item>

                <Form.Item label="Нэмэлт файл">
                    <Upload
                        beforeUpload={() => false}
                        onChange={({ fileList }) => setAdditionalFileList(fileList)}
                        fileList={additionalFileList}
                        onRemove={file => setAdditionalFileList(additionalFileList.filter(f => f.uid !== file.uid))}
                        accept=".pdf"
                        multiple
                    >
                        <Button icon={<UploadOutlined />}>Нэмэлт файл сонгох</Button>
                    </Upload>
                </Form.Item>

                <Form.Item>
                    <Button type="primary" htmlType="submit">
                        Илгээх
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default Upload_Баримт;
