import PropTypes from "prop-types"
import { createContext } from "react"

const DataContext = createContext({})

export const DataProvider = ({ children }) => {
  const profiles = [1, 2, 3, 4, 5]
  return (
    <DataContext.Provider
      value={{
        profiles,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

DataProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

export default DataContext
