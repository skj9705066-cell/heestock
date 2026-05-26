import { ImageResponse } from "next/og";

export const size        = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "512px",
        height: "512px",
        display: "flex",
        background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        borderRadius: "110px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Bars */}
      <div
        style={{
          position: "absolute",
          bottom: "74px",
          left: "84px",
          width: "60px",
          height: "100px",
          background: "rgba(255,255,255,0.92)",
          borderRadius: "8px",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "74px",
          left: "180px",
          width: "60px",
          height: "160px",
          background: "rgba(255,255,255,0.92)",
          borderRadius: "8px",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "74px",
          left: "276px",
          width: "60px",
          height: "228px",
          background: "rgba(255,255,255,0.92)",
          borderRadius: "8px",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "74px",
          left: "372px",
          width: "60px",
          height: "300px",
          background: "rgba(255,255,255,0.92)",
          borderRadius: "8px",
        }}
      />
      {/* Trend dot */}
      <div
        style={{
          position: "absolute",
          top: "122px",
          left: "389px",
          width: "26px",
          height: "26px",
          background: "white",
          borderRadius: "50%",
        }}
      />
    </div>,
    { ...size }
  );
}
