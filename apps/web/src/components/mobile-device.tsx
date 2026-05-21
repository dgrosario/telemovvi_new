import { Typography } from "@mui/material";
import { ReactNode } from "react";
import { IPhoneMockup } from "react-device-mockup";

type MobileDeviceProps = {
  children?: ReactNode;
  image?: string;
};

export default function MobileDevice({ children, image }: MobileDeviceProps) {
  return (
    <IPhoneMockup
      hideStatusBar
      screenType="notch"
      transparentNavBar
      screenWidth={280}
      frameColor="#F2F2F2"
    >
      <main className="!select-none w-full flex flex-col">
        <header className="w-full flex-1 h-screen !max-h-[75px] bg-white select-none">
          <div className="pt-2 pl-8 pr-6 flex container items-center justify-between mx-auto w-full">
            <Typography
              variant="caption"
              fontWeight="bold"
              className="!text-gray-800"
              fontSize={10}
            >
              15:31
            </Typography>
            <div className="flex items-center justify-center gap-1">
              <i className="tabler-antenna-bars-5 !size-4" />
              <i className="tabler-wifi !size-4" />
              <i className="tabler-battery-1 !size-4" />
            </div>
          </div>
          <div className="px-3 pt-4 flex items-center justify-between">
            <i className="tabler-chevron-left !text-[#5691F7] !size-5" />
            <div className="flex items-center justify-center gap-4">
              <i className="tabler-video !text-[#5691F7] !size-5" />
              <i className="tabler-phone !text-[#5691F7] !size-5" />
            </div>
          </div>
        </header>
        <div className="flex-1 h-full relative bg-[url('/background.png')] after:content-[''] after:absolute after:top-0 after:left-0 after:w-full after:h-full after:bg-[#f5f1ebe0] bg-auto bg-center flex flex-col border w-full">
          <div
            className="z-50 flex-1 bg-top overflow-auto max-h-[459px] bg-cover"
            style={{
              backgroundImage: children ? undefined : `url('${image}')`,
              backgroundSize: children ? undefined : "100% !important",
            }}
          >
            {children}
          </div>
        </div>
        <footer className="flex-1 z-[999] w-full max-h-[70px] items-start flex gap-3 px-3 pt-2 pb-5 bg-[#FCFCFC]">
          <i className="tabler-plus !text-[#5691F7] !size-7" />
          <div className="w-full p-1 h-min flex mt-1 justify-end items-center border bg-white rounded-full">
            <i className="tabler-sticker-2 !text-[#5691F7] !size-4" />
          </div>
          <i className="tabler-camera !text-[#5691F7] !size-7" />
          <i className="tabler-microphone !text-[#5691F7] !size-7" />
        </footer>
      </main>
    </IPhoneMockup>
  );
}
