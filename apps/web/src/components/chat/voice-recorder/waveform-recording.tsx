import { formatTime } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";

type Props = {
  analyserNode: AnalyserNode | null;
};
export const WaveformRecorder: React.FC<Props> = ({ analyserNode }) => {
  const [amplitudes, setAmplitudes] = useState<number[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [svgWidth, setSvgWidth] = useState(300);
  const [secondsElapsed, setSecondsElapsed] = useState(0); // estado do timer

  const svgHeight = 40;
  const widthPerBar = 1.5;
  const barWidth = 0.75;
  const maxBars = Math.floor(svgWidth / widthPerBar);

  // Observer para redimensionar SVG
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setSvgWidth(entries[0].contentRect.width);
      }
    });

    if (svgRef.current) {
      observer.observe(svgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Atualiza as amplitudes da onda
  useEffect(() => {
    if (!analyserNode) return;

    let animationId: number;
    const bufferLength = analyserNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const update = () => {
      analyserNode.getByteTimeDomainData(dataArray);

      const isSilent = dataArray.every((v) => v === 128);
      if (isSilent) {
        animationId = requestAnimationFrame(update);
        return;
      }

      const peak =
        Math.max(...dataArray.map((val) => Math.abs(val - 128))) / 128;
      const newAmp = Math.min(1, Math.max(0, peak));

      setAmplitudes((prev) => {
        const updated = [...prev, newAmp];
        return updated.slice(-maxBars);
      });

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);

    return () => cancelAnimationFrame(animationId);
  }, [analyserNode, maxBars]);

  useEffect(() => {
    if (!analyserNode) {
      setSecondsElapsed(0);
      return;
    }

    const intervalId = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [analyserNode]);

  if (svgWidth === 0 || amplitudes.length === 0) return null;

  return (
    <>
      <div className="flex gap-2 items-center pl-4">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        <span className="text-xs">{formatTime(secondsElapsed)}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${maxBars * widthPerBar} ${svgHeight}`}
        preserveAspectRatio="none"
        className="w-full h-10"
        xmlns="http://www.w3.org/2000/svg"
      >
        {amplitudes.map((amp, i) => {
          const height = Math.max(2, amp * svgHeight * 1.5);
          const x = (maxBars - amplitudes.length + i) * widthPerBar;
          const y = (svgHeight - height) / 2;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={height}
              rx={barWidth / 2}
              ry={Math.min(height / 2, 4)}
              fill="#6B7280"
            />
          );
        })}
      </svg>
    </>
  );
};
