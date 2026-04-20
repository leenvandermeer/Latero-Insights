"use client";

import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className, style, children, ...props }, ref) => {
    const sizeClass = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";

    const variantStyle: React.CSSProperties =
      variant === "primary"
        ? { background: "var(--color-accent)", color: "#fff" }
        : variant === "danger"
        ? { background: "transparent", color: "var(--color-error, #EF4444)", border: "1px solid var(--color-error, #EF4444)" }
        : variant === "ghost"
        ? { background: "transparent", color: "var(--color-text-muted)" }
        : { background: "transparent", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg font-medium transition-opacity",
          "hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed",
          sizeClass,
          className
        )}
        style={{ ...variantStyle, ...style }}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
