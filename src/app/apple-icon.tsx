import { ImageResponse } from "next/og";

export const size        = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "180px",
        height: "180px",
        display: "flex",
        background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        borderRadius: "40px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", bottom: "26px", left: "29px",  width: "21px", height: "35px",  background: "rgba(255,255,255,0.92)", borderRadius: "3px" }} />
      <div style={{ position: "absolute", bottom: "26px", left: "63px",  width: "21px", height: "56px",  background: "rgba(255,255,255,0.92)", borderRadius: "3px" }} />
      <div style={{ position: "absolute", bottom: "26px", left: "97px",  width: "21px", height: "80px",  background: "rgba(255,255,255,0.92)", borderRadius: "3px" }} />
      <div style={{ position: "absolute", bottom: "26px", left: "131px", width: "21px", height: "105px", background: "rgba(255,255,255,0.92)", borderRadius: "3px" }} />
      <div style={{ position: "absolute", top: "40px", right: "22px", width: "10px", height: "10px", background: "white", borderRadius: "50%" }} />
    </div>,
    { ...size }
  );
}
