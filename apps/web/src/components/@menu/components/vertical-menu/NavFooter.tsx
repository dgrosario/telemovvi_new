"use client";

import styled from "@emotion/styled";
import type { ChildrenType } from "../../types";
import type { VerticalNavContextProps } from "../../contexts/verticalNavContext";
import useVerticalNav from "../../hooks/useVerticalNav";
import { verticalNavClasses } from "../../utils/menuClasses";

type StyledNavFooterProps = {
  isHovered?: VerticalNavContextProps["isHovered"];
  isCollapsed?: VerticalNavContextProps["isCollapsed"];
  transitionDuration?: VerticalNavContextProps["transitionDuration"];
};

const StyledNavFooter = styled.div<StyledNavFooterProps>`
  padding: 15px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin-top: auto;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  transition: ${({ transitionDuration }) =>
    `all ${transitionDuration}ms ease-in-out`};

  ${({ isHovered, isCollapsed }) =>
    isCollapsed && !isHovered && `align-items: center;`}
`;

const NavFooter = ({ children }: ChildrenType) => {
  const { isHovered, isCollapsed, transitionDuration } = useVerticalNav();

  return (
    <StyledNavFooter
      className={verticalNavClasses.footer}
      isHovered={isHovered}
      isCollapsed={isCollapsed}
      transitionDuration={transitionDuration}
    >
      {children}
    </StyledNavFooter>
  );
};

export default NavFooter;
