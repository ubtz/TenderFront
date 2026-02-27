// tender.utils.js
export const isEmpty = (val) => {
  if (val === null || val === "" || val === undefined || val === 0) return true;
  if (typeof val === "string" && val.startsWith("1900-01-01")) return true;
  return false;
};

export const calcCompletion = (record, mode = "default") => {
  if (!record) return 0;

  if (mode === "default") {
    const excluded = [
      "tender_id",
      "created_at",
      "created_by",
      "түтгэлзүүлсэн_огноо",
      "basket_ids",
      "Ovog",
      "Ner",
    ];

    const fields = Object.keys(record).filter(
      (k) => !excluded.includes(k)
    );

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
