// tender.utils.js
export const isEmpty = (val) => {
  if (val === null || val === "" || val === undefined || val === 0) return true;
  if (typeof val === "string" && val.startsWith("1900-01-01")) return true;
  return false;
};

export const calcCompletion = (record, mode = "default") => {
  if (!record) return 0;

  if (mode === "default") {
    const fields = [
      "шалгаруулалтын_төрөл",
      "тендерийн_төрөл",
      "Organization",
      "батлагдсан_төсөвт_өртөг",
      "тендер_нээх_огноо",
      "тендер_хаах_огноо",
      "үнэлгээ_хийсэн_огноо",
      "мэдэгдэл_тараасан_огноо",
      "гэрээ_байгуулах_эрх_олгосон_огноо",
      "тендерийн_явц_шалтгаан",
      "тайлбар",
    ];

    const filled = fields.filter((f) => !isEmpty(record[f])).length;
    return fields.length
      ? Math.round((filled / fields.length) * 100)
      : 0;
  }

  if (mode === "zuk") {
    const fields = [
      "шалгаруулалтын_төрөл",
      "тендерийн_төрөл",
      "батлагдсан_төсөвт_өртөг",
      "гэрээ_байгуулах_эрх_олгосон_огноо",
      "тайлбар",
    ];

    const filled = fields.filter((f) => !isEmpty(record[f])).length;
    return Math.round((filled / fields.length) * 100);
  }

  return 0;
};
