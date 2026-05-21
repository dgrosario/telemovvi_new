import React, { useEffect, useState } from "react";

let timer: NodeJS.Timeout;

export const MessageLoading: React.FC<{ typing: boolean }> = ({ typing }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typing) {
      setVisible(true);
      timer = setTimeout(() => {
        setVisible(false);
      }, 20000);
    } else {
      setVisible(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [typing]);

  if (!visible) return null;

  return (
    <div className="w-full flex items-center justify-end">
      <div className="flex flex-col gap-0 border leading-1.5 py-3 px-4 border-gray-200 shadow rounded-l-xl rounded-tr-xl bg-primary/90">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          className="text-white size-7"
        >
          <circle cx="4" cy="12" r="2" fill="currentColor">
            <animate
              id="spinner_qFRN"
              begin="0;spinner_OcgL.end+0.25s"
              attributeName="cy"
              calcMode="spline"
              dur="0.6s"
              values="12;6;12"
              keySplines=".33,.66,.66,1;.33,0,.66,.33"
            />
          </circle>
          <circle cx="12" cy="12" r="2" fill="currentColor">
            <animate
              begin="spinner_qFRN.begin+0.1s"
              attributeName="cy"
              calcMode="spline"
              dur="0.6s"
              values="12;6;12"
              keySplines=".33,.66,.66,1;.33,0,.66,.33"
            />
          </circle>
          <circle cx="20" cy="12" r="2" fill="currentColor">
            <animate
              id="spinner_OcgL"
              begin="spinner_qFRN.begin+0.2s"
              attributeName="cy"
              calcMode="spline"
              dur="0.6s"
              values="12;6;12"
              keySplines=".33,.66,.66,1;.33,0,.66,.33"
            />
          </circle>
        </svg>
      </div>
      <div className="w-12 h-12" />
    </div>
  );
};
