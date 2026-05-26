import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "up" | "down" | "neutral" | "blue" | "yellow" | "green" | "red";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({ children, variant = "neutral", size = "sm", className }: BadgeProps) {
  const variantMap = {
    up: "bg-red-500/10 text-red-500 border-red-500/20",
    down: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    neutral: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    yellow: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    green: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  const sizeMap = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium border rounded",
        variantMap[variant],
        sizeMap[size],
        className
      )}
    >
      {children}
    </span>
  );
}
