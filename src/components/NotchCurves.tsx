import React from "react";

interface NotchCurvesProps {
  fillColor?: string;
}

export const NotchCurves: React.FC<NotchCurvesProps> = ({ fillColor = "var(--color-island-bg)" }) => {
  return (
    <>
      <svg
        className="absolute top-0 -left-[16px] w-[16px] h-[16px] pointer-events-none z-10"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 0C8.83656 0 16 7.16344 16 16V0H0Z"
          fill={fillColor}
        />
      </svg>

      <svg
        className="absolute top-0 -right-[16px] w-[16px] h-[16px] pointer-events-none z-10"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16 0C7.16344 0 0 7.16344 0 16V0H16Z"
          fill={fillColor}
        />
      </svg>
    </>
  );
};
