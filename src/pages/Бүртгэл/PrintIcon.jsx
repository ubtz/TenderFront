import { useState, useRef, useEffect } from "react";
import { Button, Modal, Space, Table, Tooltip, Form, Input, message } from "antd";
import { PrinterFilled } from "@ant-design/icons";
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import axios from "axios";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
pdfMake.vfs = pdfFonts.vfs;


const PrintIcon = ({ normData, planId, UserId }) => {
  const [open, setOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  // console.log("planIdplanIdplanId", planId);
  const userJson = localStorage.getItem("data");
  const user = userJson ? JSON.parse(userJson) : null;
  const isUdirdlaga = user?.erh?.toLowerCase() === "удирдлага";

  const handlePrint = async () => {
    setIsModalVisible(true);

  };
  const handleOk = async () => {
    if (user?.id === UserId) {
      try {
        const values = await form.validateFields();
        console.log("✅ Form submitted:", values);

        // 1. Arrays → string (label name)
        const modStr = (values.Mod || [])
          .map(item => `${item.label}: ${item.name}`)
          .join(", ");

        const approvedStr = (values.approved || [])
          .map(item => `${item.label}: ${item.name}`)
          .join(", ");

        const executedStr = (values.executed || [])
          .map(item => `${item.label}: ${item.name}`)
          .join(", ");

        // 2. Get logged-in user ID
        const userId = user?.id || null;

        // 3. Prepare payload (added userId)
        const payload = {
          planRootNumber: planId,
          batlah: modStr,
          zuvshuursun: approvedStr,
          guitsetgesen: executedStr,
          userId: userId, // ✅ Added here
        };

        console.log("📤 Payload:", payload);

        setLoading(true);
        await axios.post(`${API_BASE_URL}/post/PostExecTeam`, payload);

        message.success("✅ ExecTeam амжилттай нэмэгдлээ");

        setIsModalVisible(false);
        form.resetFields();
        generatePDF(normData, payload);
      } catch (err) {
        console.error("❌ handleOk error:", err);
        message.error("❌ Хадгалах үед алдаа гарлаа");
      } finally {
        setLoading(false);
      }
    }
    else {
      generatePDF(normData, "");
      setIsModalVisible(false);
    }

  };


  useEffect(() => {
    if (isModalVisible && planId && UserId) {
      axios
        .get(`${API_BASE_URL}/get/GetExecTeam`)
        .then((res) => {
          console.log("📦 Full ExecTeam response:", res.data);
          console.log("🧾 Searching for planId:", planId, "UserId:", UserId);

          const data = res.data.find((item) => {
            const planNumber = item.planRootNumber || item.PlanRootNumber;
            const uid = item.userId || item.UserId;
            return String(planNumber) === String(planId) && Number(uid) === Number(UserId);
          });

          console.log("✅ Matched ExecTeam data:", data);

          if (data) {
            const parseField = (str) =>
              str
                ?.split(",")
                .map((s) => s.trim())
                .map((s) => {
                  const [label, ...rest] = s.split(":");
                  return { label: label.trim(), name: rest.join(":").trim() };
                });

            form.setFieldsValue({
              Mod: parseField(data["Батлах"]),
              approved: parseField(data["Зөвшөөрсөн"]),
              executed: parseField(data["Гүйцэтгэсэн"]),
            });
          } else {
            form.resetFields();
          }
        })
        .catch((err) => {
          console.error("❌ Fetch error:", err);
          form.resetFields();
        });
    }
  }, [isModalVisible, planId, UserId]);



  function parseNameRow(row) {
    if (!row) return { left: "", right: "" };

    // Албан тушаал, нэрийг ":" -оор салгах
    const [role, fullNamePart] = row.split(":").map((s) => s.trim());

    if (!fullNamePart) {
      return { left: role, right: "" };
    }

    // Нэрийг " " -оор салгах (эцсийнхийг овог гэж үзнэ)
    const nameParts = fullNamePart.split(" ");
    const firstNames = nameParts.slice(0, -1).join(" "); // О.А.
    const lastName = nameParts.slice(-1)[0];             // КАЗАКОВ

    return {
      left: `${role} ${firstNames}`,
      right: lastName,
    };
  }
  // console.log("normnormnorm", norm);
  // console.log("datadatadata", data);
  const generatePDF = (data, payload) => {
    const rawText = payload.zuvshuursun;

    // Коммоор салгаж мөр болгон хувиргана
    // const formattedText = rawText
    //   .split(",")
    //   .map(s => s.trim().replace(":", "               ")) // ":"-ийг устгаад зай орлуулна
    //   .join("\n");

    const row1 = payload.batlah
      ?.split(",")
      .map(s => s.trim().replace(":", "                      ")) // ":"-ийг устгаад зай орлуулна
      .join("\n");
    const row2 = payload.guitsetgesen
      ?.split(",")
      .map(s => s.trim().replace(":", "                      ")) // ":"-ийг устгаад зай орлуулна
      .join("\n");
    const row3 = payload.zuvshuursun
      ?.split(",")
      .map(s => s.trim().replace(":", "                      ")) // ":"-ийг устгаад зай орлуулна
      .join("\n");
    console.log("row1row1row1", row1);
    console.log("row2row2row2", row2);
    console.log("row3row3row3", row3);
    // if (!Array.isArray(data)) {
    //   console.error("Data is not an array:", data);
    //   return; // Stop execution if data is invalid
    // 🔹 Utility to merge duplicates in any column
    console.log("payload", payload);
    function mergeColumn(rows, colIndex) {
      let current = null;
      let startIndex = 0;

      rows.forEach((row, i) => {
        const val = row[colIndex].text;
        if (val !== current) {
          if (i > startIndex && current !== null) {
            const span = i - startIndex;

            const approxRowHeight = 15;
            const cellHeight = approxRowHeight * span;
            const textHeight = (rows[startIndex][colIndex].fontSize || 8) + 2;
            const topMargin = ((cellHeight - textHeight) / 2) * 2;

            rows[startIndex][colIndex] = {
              text: current,
              rowSpan: span,
              fontSize: 8,
              alignment: "center",
              margin: [0, topMargin, 0, 0]
            };

            for (let j = startIndex + 1; j < i; j++) {
              rows[j][colIndex] = {};
            }
          }
          current = val;
          startIndex = i;
        }

        if (i === rows.length - 1 && current !== null) {
          const span = i - startIndex + 1;

          const approxRowHeight = 15;
          const cellHeight = approxRowHeight * span;
          const textHeight = (rows[startIndex][colIndex].fontSize || 8) + 2;
          const topMargin = ((cellHeight - textHeight) / 2) * 2;

          rows[startIndex][colIndex] = {
            text: current,
            rowSpan: span,
            fontSize: 8,
            alignment: "center",
            margin: [0, topMargin, 0, 0]
          };

          for (let j = startIndex + 1; j <= i; j++) {
            rows[j][colIndex] = {};
          }
        }
      });
    }

    // 🔹 Re-index first column based on merged basket_number (col 2)
    // 🔹 Re-index first column based on merged basket_number (col 2)
    function numberFirstColumn(rows) {
      let counter = 1;

      rows.forEach((row, i) => {
        if (row[1]?.rowSpan) {
          const span = row[1].rowSpan;
          const approxRowHeight = 15;
          const cellHeight = approxRowHeight * span;
          const textHeight = (row[0].fontSize || 8) + 2;
          const topMargin = ((cellHeight - textHeight) / 2) * 2; // adjust to center

          row[0] = {
            text: counter.toString(),
            rowSpan: span,
            fontSize: 8,
            alignment: "center",   // horizontal center
            margin: [0, topMargin, 0, 0] // vertical center
          };

          for (let j = i + 1; j < i + span; j++) {
            rows[j][0] = {};
          }

          counter++;
        }
      });
    }

    // 🔹 Main
    function buildRows(data) {
      const rows = [];

      data.baskets.forEach((basket) => {
        if (!Array.isArray(basket.items)) return;

        basket.items.forEach((item, itemIndex) => {
          rows.push([
            { text: "", fontSize: 8, alignment: "center" }, // 0
            { text: basket.basket_type?.trim() || "", fontSize: 8 },                 // 1
            { text: basket.basket_number || "", fontSize: 8, alignment: "center" }, // 2
            { text: basket.basket_name || "", fontSize: 8, alignment: "center" },   // 3
            { text: (itemIndex + 1).toString(), fontSize: 8, alignment: "center" }, // 4
            { text: item.cr4name + " * " + item.crmarkname || "", fontSize: 8, alignment: "left" },
            { text: item.mname || "", fontSize: 8, alignment: "center" },
            { text: item.zno || "", fontSize: 8, alignment: "center" },
            { text: item.usize || "", fontSize: 8, alignment: "center" },
            {
              text: item.qty !== undefined && item.qty !== null
                ? Number(item.qty).toLocaleString("en-US")
                : "",
              fontSize: 8,
              alignment: "center"
            },

            { text: item.price || "", fontSize: 8, alignment: "left" },
            { text: (Number(item.qty || 0) * Number(item.price || 0)).toString(), fontSize: 8, alignment: "right" },
            { text: basket.total_price?.toString() || "", fontSize: 8, alignment: "right" },
            { text: data.total_price?.toString() || "", fontSize: 8, alignment: "right" },
            { text: basket.publish_date?.toString() || "", fontSize: 8, alignment: "right" },
            { text: item.dname?.toString() || "", fontSize: 8, alignment: "right" },
          ]);
        });
      });

      mergeColumn(rows, 1);
      mergeColumn(rows, 2);
      mergeColumn(rows, 3);
      mergeColumn(rows, 13);
      mergeColumn(rows, 14);

      // 
      numberFirstColumn(rows);

      return rows;
    }


    const tableBodyData = buildRows(data);


    console.log("tableBodyData", tableBodyData);
    // Flatten the array to avoid nested arrays
    // const flattenedTableBodyData = tableBodyData.flat();

    // console.log("flattenedTableBodyData", flattenedTableBodyData);
    // Rest of the PDF generation logic...
    const groupedBodyRows = [];

    let groupIndex = 0; // Initialize a counter for the group index
    let previousHeaderText = null;
    let groupTotal = 0; // Initialize a variable to track the total for the group
    let currentText = "";
    // flattenedTableBodyData.forEach((row, index) => {
    //   currentText = row[1]?.text; // Assuming the second column contains the header text

    //   // Check if the current row starts a new group
    //   if (currentText && currentText !== previousHeaderText) {
    //     // Add a total row for the previous group (if applicable)
    //     if (previousHeaderText !== null) {
    //       groupedBodyRows.push([
    //         {
    //           text: previousHeaderText + " - ын дүн",
    //           fontSize: 7,
    //           alignment: "center",
    //           bold: true,
    //           margin: [0, 5, 0, 5],
    //           colSpan: 15, // Span two columns
    //         },
    //         {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, // Empty cells to account for colSpan
    //         {},
    //         {
    //           text: groupTotal.toLocaleString("en-US", {
    //             minimumFractionDigits: 2,
    //             maximumFractionDigits: 2,
    //           }), // Format the total value
    //           fontSize: 6,
    //           alignment: "right",
    //           margin: [-3, 0, -3, 0],
    //         },
    //         {
    //           text: "",
    //           fontSize: 6,
    //           alignment: "right",
    //           bold: true,
    //         },
    //         {
    //           text: "",
    //           fontSize: 6,
    //           alignment: "right",
    //           bold: true,
    //         },
    //       ]);
    //     }

    //     // Add a header row for the new group
    //     groupedBodyRows.push([
    //       {
    //         text: currentText,
    //         colSpan: 18,
    //         alignment: "center",
    //         bold: true,
    //         fontSize: 9,
    //         margin: [0, 5, 0, 5],
    //       },
    //       ...Array(17).fill({}), // Fill remaining columns to match full width
    //     ]);

    //     // Reset the group total for the new group
    //     groupTotal = 0; // Reset the total for the new group
    //     previousHeaderText = currentText;
    //   } else if (!currentText) {
    //     // If no valid header is found, make only row[1]?.text empty
    //     if (row[1]) {
    //       row[1].text = ""; // Clear only the text in the second column
    //     }
    //   }

    //   // Add the value of row[16] to the group total
    //   const rowValue = parseFloat((row[15]?.text || "0").replace(/,/g, ""));
    //   groupTotal += rowValue;

    //   // Set row[1]?.text to empty after checking
    //   if (row[1]) {
    //     row[1].text = ""; // Clear the text in the second column
    //   }

    //   // Update the first column of the row with the global index (starting from 1)
    //   row[0] = {
    //     text: index + 1, // Use the global index (1-based)
    //     fontSize: 8,
    //     alignment: "center",
    //     margin: [0, 5, 0, 5], // Adjust top and bottom margins for vertical alignment
    //   };

    //   // Add the row to the grouped body rows
    //   groupedBodyRows.push(row);
    // });
    // // Add a total row for the last group (if applicable)
    // if (previousHeaderText !== null) {
    //   groupedBodyRows.push([
    //     {
    //       text: (currentText && currentText.trim() !== "" ? currentText : previousHeaderText) + " - ын дүн",
    //       fontSize: 7,
    //       alignment: "center",
    //       bold: true,
    //       margin: [0, 5, 0, 5],
    //       colSpan: 15, // Span two columns
    //     },
    //     {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},  // Empty cells to account for colSpan
    //     {},
    //     {
    //       text: groupTotal.toLocaleString("en-US", {
    //         minimumFractionDigits: 2,
    //         maximumFractionDigits: 2,
    //       }), // Format the total value
    //       fontSize: 6,
    //       alignment: "right",
    //       // bold: true,
    //       margin: [-3, 0, -3, 0]
    //     },
    //     {
    //       text: "",
    //       fontSize: 6,
    //       alignment: "right",
    //       bold: true,
    //     },
    //     {
    //       text: "",
    //       fontSize: 6,
    //       alignment: "right",
    //       bold: true,
    //     },
    //   ]);
    // }

    // Add an empty row at the bottom of the last group (if applicable)


    // Add an empty row at the bottom of the table



    var ruTextColor = 'black';
    var titleColor = 'black';
    var mnTextColor = 'black';
    var year = new Date().getFullYear();
    var month = new Date().getMonth() + 1; // JavaScript months start from 0
    var day = new Date().getDate();
    var tableBody = [];
    var dd = {
      content: [
        {
          margin: [0, 0, 0, 0],
          columns: [
            {
              // text: `Хамрах хугацаа [${new Date(data.startDate).toISOString().split("T")[0]} - ${new Date(data.endDate).toISOString().split("T")[0]}]`,
              alignment: "Left",
              fontSize: 8,
              text: `Батлав`,
            },
          ],
        },
        {
          margin: [0, 0, 0, 0],
          columns: [
            {
              // text: `Хамрах хугацаа [${new Date(data.startDate).toISOString().split("T")[0]} - ${new Date(data.endDate).toISOString().split("T")[0]}]`,
              alignment: "Left",
              fontSize: 8,
              text: `${row1 || ""}`,
            },
          ],
        },
        {
          table: {
            headerRows: 1,
            body: tableBody,
          },
          columns: [
            {
              text: '',
              alignment: 'center', // Align title to left
            },
            // {
            //   text: new Date().toLocaleDateString(), // Date on the right
            //   style: 'dateStyle',
            //   alignment: 'right',
            //   margin: [0, 0, 10, 0] // Adds right margin for spacing
            // }
          ]
        },
        {
          text: `[${data.plan_name || ""}]`,
          alignment: 'center',
          fontSize: 7,
          margin: [0, 10, 0, 0]
        },
        {
          text: '/Дэлгэрэнгүй/',
          alignment: 'center', // Align title to left
          fontSize: 7,
          margin: [0, 0, 10, 0]
        },
        // {
        //   text: `${payload.batlah || ""}`,
        //   alignment: 'left', // Align title to left
        //   fontSize: 7,
        //   bold: true,
        // },
        {
          columns: [
            {
              text: ``,
              alignment: "left",
              fontSize: 7,
            },
            {
              // город Улан-Батор
              text: `${year}.${month}.${day}`, // Date on the right
              alignment: "right",
              fontSize: 7,
            },
          ],
          color: ruTextColor,
          margin: [0, 0, 0, 0],
        },
        {
          style: 'tableExample',
          table: {
            widths: [
              "2%", "8%",
              "2%", "8%",
              "2%", "10.5%", "5%", "5%", "4.3%", "5%", "8%", "8%",
              "8%", "8%",
              "8%", "8%",
            ],

            body: [
              // 🔹 1-р мөр (Main Headers)
              [
                { text: 'Тендер', colSpan: 2, fontSize: 8, alignment: 'center', bold: true }, {},
                { text: 'Багц', colSpan: 2, fontSize: 9, alignment: 'center', bold: true }, {},
                { text: 'Бараа материал', colSpan: 8, fontSize: 9, alignment: 'center', bold: true },
                {}, {}, {}, {}, {}, {}, {},

                // 🔹 Apply margin hack to rowSpan cells
                { text: 'Багцын дүн, төг', fontSize: 9, rowSpan: 2, alignment: 'center', bold: true, margin: [0, 12, 0, 0] },
                { text: 'Тендерийн нийт дүн, төг', fontSize: 9, rowSpan: 2, alignment: 'center', bold: true, margin: [0, 12, 0, 0] },
                { text: 'Тендер зарлах огноо', fontSize: 9, rowSpan: 2, alignment: 'center', bold: true, margin: [0, 12, 0, 0] },
                { text: 'Захиалагч', fontSize: 9, rowSpan: 2, alignment: 'center', bold: true, margin: [0, 12, 0, 0] }
              ],

              // 🔹 2-р мөр (Sub Headers)
              [
                { text: '№', style: 'subHeader', fontSize: 6 },
                { text: 'Ангилал', style: 'subHeader', fontSize: 6 },
                { text: '№', style: 'subHeader', fontSize: 6 },
                { text: 'Нэр', style: 'subHeader', fontSize: 6 },
                { text: '№', style: 'subHeader', fontSize: 6 },
                { text: 'Нэр', style: 'subHeader', fontSize: 6 },
                { text: 'Нормт хэмжээ', style: 'subHeader', fontSize: 6 },
                { text: 'Зургийн дугаар', style: 'subHeader', fontSize: 6 },
                { text: 'Хэмжих нэгж', style: 'subHeader', fontSize: 6 },
                { text: 'Тоо хэмжээ', style: 'subHeader', fontSize: 6 },
                { text: 'Нэгж үнэ, төг/2025он/', style: 'subHeader', fontSize: 6 },
                { text: 'Нийт дүн,төг', style: 'subHeader', fontSize: 6 },
              ],

              ...tableBodyData,
            ]
          },
          layout: {
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
          heights: (rowIndex) => {
            if (rowIndex === 0) return 30; // make header row taller
            if (rowIndex === 1) return 20; // sub-header row
            return 15;
          }
        },
        // Names and Positions Section with Date on the Right
        // { text: 'Төлөвлөлт үүсгэсэн ажилтан: албан тушаал товч -овог нэр  /...................................../', margin: [100, 5, 0, 0], alignment: 'left', fontSize: 7 },
        // { text: 'Зөвшилцсөн:', margin: [70, 5, 0, 0], alignment: 'left', fontSize: 7 },
        // { text: '/Зөвшилцсөн албан тушаал/      /Зөвшилцсөн Овог, нэр/', margin: [130, 5, 0, 0], alignment: 'left', fontSize: 7, color: 'gray' },
        // {
        //   text: 'Зөвшилцсөн:',
        //   margin: [70, 5, 0, 0],
        //   alignment: 'left',
        //   fontSize: 7
        // },
        {
          text: 'Зөвшилцсөн:',
          margin: [130, 5, 0, 0],
          alignment: 'left',
          fontSize: 8
        },
        {
          text: row3,
          margin: [130, 5, 0, 0],
          alignment: 'left',
          fontSize: 8
        },
        {
          text: 'Гүйцэтгэсэн:',
          margin: [130, 5, 0, 0],
          alignment: 'left',
          fontSize: 8
        },
        {
          text: row2,
          margin: [130, 5, 0, 0],
          alignment: 'left',
          fontSize: 8
        },
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 10],
          alignment: 'center'
        },
        subheader: {
          fontSize: 16,
          bold: true,
          margin: [0, 10, 0, 5]
        },
        tableExample: {
          margin: [0, 5, 0, 15]
        },
        tableHeader: {
          bold: true,
          fontSize: 13,
          alignment: 'center'
        },
        subHeader: {
          bold: true,
          fontSize: 12,
          alignment: 'center'
        },
        dateStyle: {
          fontSize: 1,
          alignment: 'right',
          color: 'black'
        }
      },
      pageOrientation: 'landscape',
      // header: function () {
      //   return [
      //     {
      //       margin: [0, 0, 30, 0],
      //       text: [
      //         {
      //           text: "\n\nЗөвхөн дотоод албан хэрэгцээнд\n",
      //           color: titleColor,
      //         },
      //       ],
      //       alignment: "right",
      //       fontSize: 7,
      //     },
      //     {
      //       canvas: [
      //         { type: "rect", x: 30, y: 5, w: 782, h: 0.2, color: ruTextColor },
      //       ],
      //     },
      //   ];
      // },
      content1: [
        ,
      ],
      footer: function (currentPage, pageCount) {
        return [
          // {
          //   canvas: [
          //     {
          //       type: "rect",
          //       x: 30,
          //       y: 5,
          //       w: 782,
          //       h: 0.2,
          //       color: ruTextColor,
          //     },
          //   ],
          // },
          {
            columns: [
              {
                width: 600,
                alignment: "left",
                fontSize: 7,
                margin: [30, 0, 0, 0],
                color: ruTextColor,
                text: [
                  {
                    text: "© Цахим худалдан авалтын систем",
                    italics: true,
                  },
                ],
              },
              {
                alignment: "right",
                fontSize: 7,
                margin: [0, 0, 30, 0],
                color: ruTextColor,
                text: [
                  {
                    text: "Хуудас: ",
                    italics: true,
                  },
                  {
                    text: `${currentPage.toString()}`,
                    italics: true,
                  },
                ],
              },
            ],
          },
        ];
      },
      info: {
        title: 'Гүйцэтгэл', // <- THIS is what changes the title you see
        author: 'Your Name',
        subject: 'PDF Subject',
        keywords: 'keywords here',
      }

    };
    pdfMake.createPdf(dd).getDataUrl((dataUrl) => {
      setPdfUrl(dataUrl);
      setOpen(true);
    });
    // pdfMake.createPdf(dd).download("document.pdf"); // Uncomment to download instead
  };
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
          {pdfUrl && <iframe src={pdfUrl} width="1200" height="900px" />}
        </Modal>
      </Tooltip>
      <Modal
        title="Төлөвлөгөө батлах"
        open={isModalVisible}
        onOk={handleOk}
        confirmLoading={loading}
        onCancel={() => setIsModalVisible(false)}
        okText="Баталгаажуулах"
        cancelText="Болих"
        width={700}
      >
        <Form form={form} layout="vertical" disabled={isUdirdlaga}>
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
                    {!isUdirdlaga && (
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{ color: "red", cursor: "pointer" }}
                      />
                    )}
                  </Space>
                ))}
                {!isUdirdlaga && (
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
                    {!isUdirdlaga && (
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{ color: "red", cursor: "pointer" }}
                      />
                    )}
                  </Space>
                ))}
                {!isUdirdlaga && (
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
                    {!isUdirdlaga && (
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{ color: "red", cursor: "pointer" }}
                      />
                    )}
                  </Space>
                ))}
                {!isUdirdlaga && (
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
