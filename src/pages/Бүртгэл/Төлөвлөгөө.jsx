import React from "react";
import { Card, Form, Input, Button, DatePicker, Select } from "antd";
import ТөлөвлөгөөTable from "./Төлөвлөгөө_table"; // Adjust the path as needed

const { Option } = Select;

const Төлөвлөгөө = () => {
    return (
        <div style={{ padding: 24 }}>


            <Card title="Төлөвлөгөөний жагсаалт" style={{ marginTop: 24 }}>
                <ТөлөвлөгөөTable />
            </Card>
        </div>
    );
};

export default Төлөвлөгөө;
