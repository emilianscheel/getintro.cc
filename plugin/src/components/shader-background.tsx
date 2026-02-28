import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

const SHADER_VIDEO_SRC =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/alt-g7Cv2QzqL3k6ey3igjNYkM32d8Fld7.mp4";

const placeholderSrc = chrome.runtime.getURL("alt-placeholder.png");

export const ShaderBackground = ({ className }: { className?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const handleLoadedData = () => {
      setIsVideoLoaded(true);
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("canplay", handleLoadedData);

    return () => {
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("canplay", handleLoadedData);
    };
  }, []);

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <img
        src={placeholderSrc}
        alt="Shader background"
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
          isVideoLoaded ? "opacity-0" : "opacity-100"
        )}
      />
      <video
        ref={videoRef}
        src={SHADER_VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
          isVideoLoaded ? "opacity-100" : "opacity-0"
        )}
      />
      <div className="absolute inset-0 bg-black/20" />
    </div>
  );
};
