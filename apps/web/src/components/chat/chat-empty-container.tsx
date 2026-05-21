import Image from "next/image";
import React from "react";

type Props = {
  hidden: boolean;
};

export const ChatEmptyContainer: React.FC<Props> = ({ hidden }) => (
  <div
    className={`w-full flex-1 gap-6 flex-col relative justify-center items-center hidden md:flex ${hidden ? "md:hidden" : ""}`}
    data-hidden={hidden}
  >
    <div className="w-full h-full absolute top-0 left-0 z-10 bg-white opacity-50" />
    <Image
      className="grayscale w-full max-w-[600px] !opacity-40"
      src="/logo.png"
      width={1000}
      height={1000}
      alt="icon"
    />
    <span className="font-light text-muted-foreground">
      Selecione uma conversa pra continuar
    </span>
  </div>
);
