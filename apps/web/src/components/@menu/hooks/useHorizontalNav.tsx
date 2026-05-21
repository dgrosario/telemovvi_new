// React Imports
import { useContext } from "react";

// Context Imports
import HorizontalNavContext from "../contexts/horizontalNavContext";

const useHorizontalNav = () => {
  // Hooks
  const context = useContext(HorizontalNavContext);

  if (context === undefined) {
    throw new Error("HorizontalNav Component is required!");
  }

  return context;
};

export default useHorizontalNav;
