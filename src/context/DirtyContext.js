import { createContext } from "react";

const DirtyContext = createContext({
  isDirty: false,
  setIsDirty: () => {},
});

export default DirtyContext;