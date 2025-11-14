import React from "react";
import { Card, Form, Input, Button, DatePicker, Select } from "antd";
import dayjs from "dayjs";
import ХяналтTable from "./Хяналт_table"; // Adjust the path as needed


const Хяналт = () => {
    return (
        <div style={{ padding: 24 }}>


            <Card title="Төлөвлөгөөний жагсаалт" style={{ marginTop: 24 }}>
                <ХяналтTable />
            </Card>
        </div>
    );
};

export default Хяналт;
