import { useEffect, useRef, useState } from "react";

const createDraftSession = (record, visible) => ({
  id: record?.GereeId,
  record,
  visible,
  edits: new Map(),
  saves: new Map(),
});

export const useContractDraft = (record, visible, onSave) => {
  const [draft, setDraftRecord] = useState(record);
  const session = useRef(createDraftSession(record, visible));

  useEffect(() => {
    let current = session.current;
    if (current.id !== record?.GereeId || (visible && !current.visible)) {
      current = createDraftSession(record, visible);
      session.current = current;
    }
    current.record = record;
    current.visible = visible;
    const edits = Object.fromEntries(
      [...current.edits].map(([field, edit]) => [field, edit.value])
    );
    setDraftRecord(record ? { ...record, ...edits } : record);
  }, [record, visible]);

  const setDraft = (field, value) => {
    const edit = { value };
    session.current.edits.set(field, edit);
    setDraftRecord((current) => ({ ...current, [field]: value }));
    return edit;
  };

  const saveField = async (field, value) => {
    const current = session.current;
    const edit = setDraft(field, value);
    // A second save of the same field must reach the server after the first.
    const previous = current.saves.get(field) || Promise.resolve();
    const request = previous.catch(() => {}).then(() => onSave(current.id, field, value));
    current.saves.set(field, request);
    let saved = false;
    try {
      saved = await request;
      return saved;
    } finally {
      if (current.saves.get(field) === request) current.saves.delete(field);
      if (session.current === current && current.edits.get(field) === edit) {
        current.edits.delete(field);
        if (!saved) {
          // Revert only this failed edit, preserving other fields and newer edits.
          setDraftRecord((valueNow) => ({ ...valueNow, [field]: current.record?.[field] }));
        }
      }
    }
  };

  return { draft, setDraft, saveField };
};
