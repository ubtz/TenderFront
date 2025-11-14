import React, { useEffect, useState } from "react";
import { Form, Input, Button, Typography, message, DatePicker, InputNumber, Row, Col, Checkbox, Select, Table } from "antd";
import dayjs from "dayjs";
import axios from "axios";

const { Title } = Typography;

const Tender_Бүртгэх = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const API_BASE_URL = import.meta.env.VITE_API_URL;
    const userJson = localStorage.getItem("data");
    const user = userJson ? JSON.parse(userJson) : null;
    const [dnames, setDnames] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null); // ⬅️ plan сонгогдох үед хадгалах state

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${API_BASE_URL}/get/GetAllValid`);
                console.log("✅ Valid plans:", res.data);

                // transform data if needed
                const transformed = res.data.map((plan, index) => ({
                    key: `plan-${plan.plan_root_number}`,
                    index: index + 1,
                    ...plan,
                }));

                setData(transformed);
            } catch (err) {
                console.error("❌ Error fetching valid plans:", err);
                message.error("Valid төлөвлөгөө татахад алдаа гарлаа");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [API_BASE_URL]);
    console.log("Fetched valid plans data:", data);
    const handleFinish = async (values) => {
        setLoading(true);
        console.log("ForselectedPlanes:", selectedPlan);
        const payload = {
            plan_root_number: selectedPlan.plan_root_number,
            tender_name: selectedPlan.plan_name,
            шалгаруулалтын_төрөл: values.selectionType,
            тендерийн_дугаар: values.tenderNumber,
            тендерийн_төрөл: values.tenderType,
            батлагдсан_төсөвт_өртөг: values.approvedBudget,
            урилгын_дугаар: values.invitationNumber,
            урилгын_огноо: values.invitationDate ? values.invitationDate.format("YYYY-MM-DD") : null,
            үнэлгээ_хийсэн_огноо: values.evaluationDate ? values.evaluationDate.format("YYYY-MM-DD") : null,
            мэдэгдэл_тараасан_огноо: values.notificationDate ? values.notificationDate.format("YYYY-MM-DD") : null,
            гэрээ_байгуулах_эрх_олгосон: values.contractPermission ? values.contractPermission.format("YYYY-MM-DD") : null,
            гомдол_гаргасан_огноо: values.complaintDate ? values.complaintDate.format("YYYY-MM-DD") : null,
            түтгэлзүүлсэн_огноо: values.suspendedDate ? values.suspendedDate.format("YYYY-MM-DD") : null,
            тендер_амжилттай_болсон_эсэх: values.isSuccessful || false,
            тендерийн_явц_шалтгаан: values.processReason,
            тайлбар: values.comment,
            created_by: userJson ? JSON.parse(userJson).id : null,
            тендер_нээх_огноо: values.TenderStartDate ? values.TenderStartDate.format("YYYY-MM-DD HH:mm") : null,
            тендер_хаах_огноо: values.TenderEndDate ? values.TenderEndDate.format("YYYY-MM-DD HH:mm") : null,
            tender_participants: values.TenderParticipants ? values.TenderParticipants : "Empty",
            organization: values.organization,

        };
        console.log("Submitting tender payload:", payload);
        try {
            const res = await axios.post(`${API_BASE_URL}/post/PostTender`, payload);

            message.success("✅ Тендер амжилттай хадгалагдлаа!");
            console.log("payload:", payload);

            form.resetFields();
        } catch (err) {
            console.error("❌ Error creating tender:", err);
            message.error("Тендер хадгалахад алдаа гарлаа.");
        } finally {
            setLoading(false);
        }
    };

    const handlePlanChange = (planRootNumber) => {
        // Reset selected plan initially
        const selectedPlan = data.find(p => p.plan_root_number === planRootNumber);
        setSelectedPlan(selectedPlan);
        if (selectedPlan) {
            console.log("✅ Сонгосон төлөвлөгөө:", selectedPlan);

            form.setFieldsValue({
                organization: [
                    ...new Set(
                        selectedPlan.baskets.flatMap(basket =>
                            basket.items.map(item => item.dname)
                        )
                    )
                ].join(", "),
                basketCount: selectedPlan.baskets ? selectedPlan.baskets.length : 0, // хамгаалалт
            });
            console.log("Автоматаар бөглөгдсөн байгууллага:", selectedPlan.baskets.length);
        }
    };




    return (

        <div style={{
            maxWidth: 1000,
            margin: "40px auto",
            background: "#fff",
            padding: 24,
            borderRadius: 8,
            boxShadow: "0 0 8px rgba(0,0,0,0.05)"
        }}>
            {/* Section 1: Захиалга */}
            <Title level={4} style={{ textDecoration: "underline" }}>
                ЗАХИАЛГА
            </Title>

            <Form
                form={form}
                layout="horizontal"
                onFinish={handleFinish}
                labelCol={{ span: 9 }}      // 👈 set once globally
                wrapperCol={{ span: 16 }}   // 👈 set once globally
            >
                <Form.Item
                    label="Худалдан авах ажил, үйлчилгээний нэр"
                    name="planName"
                    rules={[{ required: true, message: "Төлөвлөгөө сонгоно уу!" }]}
                >
                    <Select placeholder="Төлөвлөгөө сонгоно уу" onChange={handlePlanChange}>
                        {data.map(plan => (
                            <Option key={plan.plan_root_number} value={plan.plan_root_number}>
                                {plan.plan_name}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                {/* Байгууллага - автоматаар бөглөгдөнө */}
                <Form.Item
                    label="Байгууллага"
                    name="organization"

                    rules={[{ required: true, message: "Байгууллага оруулна уу!" }]}
                >
                    <Input placeholder="Байгууллагын нэрс автоматаар бөглөгдөнө" disabled />
                </Form.Item>

                {/* Section 2: Тендер */}
                <Title
                    level={4}
                    style={{ textDecoration: "underline", textDecorationSkipInk: "none", marginTop: 24 }}
                >
                    ТЕНДЕР
                </Title>



                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Шалгаруулалтын төрөл"
                            name="selectionType"
                            rules={[{ required: true, message: "Шалгаруулалтын төрөл оруулна уу!" }]}
                        >
                            <Select placeholder="Төрөл сонгоно уу">
                                <Select.Option value="Бараа">Бараа</Select.Option>
                                <Select.Option value="Ажил үйлчилгээ">Ажил үйлчилгээ</Select.Option>
                                <Select.Option value="Зөвлөх үйлчилгээ">Зөвлөх үйлчилгээ</Select.Option>
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Тендерийн дугаар"
                            name="tenderNumber"
                            rules={[{ required: true, message: "" }]}
                        >
                            <Input placeholder="" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label="Зарласан огноо"
                            name="announceDate"
                            rules={[{ required: true, message: "Зарласан огноо оруулна уу!" }]}
                        >
                            <DatePicker style={{ width: "100%" }} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Тендерийн төрөл"
                            name="tenderType"
                            rules={[{ required: true, message: "Тендерийн төрөл оруулна уу!" }]}
                        >
                            <Select placeholder="Төрөл сонгоно уу">
                                <Select.Option value="Цахим">Цахим</Select.Option>
                                <Select.Option value="Уламжлалт">Уламжлалт</Select.Option>
                            </Select>
                        </Form.Item>

                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label="Батлагдсан төсөвт өртөг"
                            name="approvedBudget"
                            rules={[{ required: true, message: "Батлагдсан төсөвт өртөг оруулна уу!" }]}
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                step={0.01}
                                formatter={(value) =>
                                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                                }
                                parser={(value) =>
                                    value ? value.replace(/₮\s?|(,*)/g, "") : ""
                                }
                                precision={2} // 👈 хоёр оронтой бутархай
                                placeholder="Жишээ: 10,000,000.00 ₮"
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Урилгийн дугаар"
                            name="invitationNumber"
                            rules={[{ required: true, message: "Урилгийн дугаар оруулна уу!" }]}
                        >
                            <Input />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label="Урилгийн огноо"
                            name="invitationDate"
                            rules={[{ required: true, message: "Урилгийн огноо оруулна уу!" }]}
                        >
                            <DatePicker style={{ width: "100%" }} />
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Тендер нээх огноо"
                            name="TenderStartDate"
                            rules={[{ required: true, message: "Тендер нээх огноо оруулна уу!" }]}
                        >
                            <DatePicker
                                showTime        // 🚀 enables time picker
                                format="YYYY-MM-DD HH:mm"
                                style={{ width: "80%" }}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            label="Тендер хаах огноо"
                            name="TenderEndDate"
                            rules={[{ required: true, message: "Тендер хаах огноо оруулна уу!" }]}
                        >
                            <DatePicker
                                showTime        // 🚀 enables time picker
                                format="YYYY-MM-DD HH:mm"
                                style={{ width: "80%" }}
                            />
                        </Form.Item>
                    </Col>
                </Row>
                {/* <Form.Item
                    label="Тендерт оролцогч"
                    name="TenderParticipants"
                    rules={[{ required: true, message: "Урилгийн дугаар оруулна уу!" }]}
                >
                    <Input />
                </Form.Item> */}
                {/* Багцын тоо мэдээлэл
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Багцын тоо мэдээлэл"
                            name="basketCount"
                        >
                            <Input disabled />
                        </Form.Item>
                    </Col>
                </Row> */}


                {/* Багцын мэдээллийг мөрөөр харуулах хэсэг */}
                {selectedPlan && selectedPlan.baskets && selectedPlan.baskets.length > 0 && (
                    <div
                        style={{
                            marginTop: 16,
                            marginRight: 36,
                            marginLeft: 36,
                            marginBottom: 16,
                            padding: 16,
                            border: "1px solid #eee",
                            borderRadius: 4,
                            background: "#C9C9C9",
                        }}
                    >
                        <h4>Багцуудын мэдээлэл:</h4>
                        <Table
                            dataSource={selectedPlan.baskets.map((b, index) => {
                                // 🟢 items доторх pricesum нийлбэрийг тооцоолох
                                const totalPrice = b.items
                                    ? b.items.reduce((sum, item) => sum + (item.pricesum || 0), 0)
                                    : 0;

                                return {
                                    key: index,
                                    basketNumber: b.basket_number,
                                    basketName: b.basket_name,
                                    basketType: b.basket_type,
                                    publishDate: b.publish_date,
                                    totalPrice,
                                };
                            })}
                            columns={[
                                { title: "Багцын дугаар", dataIndex: "basketNumber", key: "basketNumber" },
                                { title: "Багцын нэр", dataIndex: "basketName", key: "basketName" },
                                { title: "Төрөл", dataIndex: "basketType", key: "basketType" },
                                { title: "Нийтлэсэн огноо", dataIndex: "publishDate", key: "publishDate" },
                                {
                                    title: "Нийт үнэ",
                                    dataIndex: "totalPrice",
                                    key: "totalPrice",
                                    render: (value) => value.toLocaleString() + "₮", // ₮ тэмдэгтэй форматлах
                                },
                            ]}
                            pagination={false}
                            size="small"
                            bordered
                        />
                    </div>
                )}
                {

/* 
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label="Гэрээ байгуулах эрх олгосон" name="contractPermission">
                            <DatePicker style={{ width: "80%", marginLeft: "20px" }} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Гомдол гаргасан огноо" name="complaintDate">
                            <DatePicker style={{ width: "80%", marginLeft: "20px" }} />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item label="Түтгэлзүүлсэн огноо" name="suspendedDate">
                    <DatePicker style={{ width: "100%" }} />
                </Form.Item>

                <Form.Item label="Тендер амжилттай болсон эсэх" name="isSuccessful" valuePropName="checked">
                    <Checkbox>Амжилттай</Checkbox>
                </Form.Item>

                <Form.Item label="Тендерийн явц шалтгаан" name="processReason">
                    <Input placeholder="Жишээ: Төсөв хүрэлцээгүй" />
                </Form.Item>

                <Form.Item label="Тайлбар" name="comment">
                    <Input.TextArea placeholder="Тайлбар оруулна уу" />
                </Form.Item> */}

                <Form.Item wrapperCol={{ span: 24 }}>
                    <Button type="primary" htmlType="submit" loading={loading} block>
                        Бүртгэх
                    </Button>
                </Form.Item>
            </Form>
        </div >
    );
};

export default Tender_Бүртгэх;
