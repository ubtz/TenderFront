import React from "react";
import { Card, Row, Col, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import {
    ApartmentOutlined,
    BranchesOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

const ЯвцMain = () => {
    const navigate = useNavigate();

    return (
        <div style={{ padding: 40 }}>
            <Title level={3} style={{ textAlign: "center", marginBottom: 40 }}>
                Явц сонгох
            </Title>

            <Row gutter={24} justify="center">
                <Col xs={24} md={10} lg={8}>
                    <Card
                        hoverable
                        onClick={() =>
                            navigate("/Явц2", {
                                state: { mode: "Явц2" }, // 👈 Явц 1
                            })
                        }
                        style={{ textAlign: "center", height: 200 }}
                    >
                        <ApartmentOutlined style={{ fontSize: 40 }} />
                        <Title level={4} style={{ marginTop: 20 }}>
                            Захиалгаар харах
                        </Title>
                        <Text type="secondary">
                            Бараа материалын захиалгаар харах
                        </Text>
                    </Card>
                </Col>

                <Col xs={24} md={10} lg={8}>
                    <Card
                        hoverable
                        onClick={() =>
                            navigate("/Явц1", {
                                state: { mode: "Явц1" }, // 👈 Явц 2
                            })
                        }
                        style={{ textAlign: "center", height: 200 }}
                    >
                        <BranchesOutlined style={{ fontSize: 40 }} />
                        <Title level={4} style={{ marginTop: 20 }}>
                            Зураглалаар харах
                        </Title>
                        <Text type="secondary">
                            Процессийн зураглалаар харах
                        </Text>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default ЯвцMain;
