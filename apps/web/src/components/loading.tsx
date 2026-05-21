import { Spinner } from "./ui/spinner";

type Props = {
  text?: string;
};

export const LoadingComponent: React.FC<Props> = (props) => {
  return (
    <div className="fixed flex-col gap-4 inset-0 z-[9999] flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <Spinner size="xl" />
      <span className="animate-pulse text-gray-600 text-sm">
        {props.text || "Carregando..."}
      </span>
    </div>
  );
};
