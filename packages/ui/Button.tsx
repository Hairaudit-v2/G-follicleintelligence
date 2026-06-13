import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

import type { NetworkPlatform } from "./tokens";

const networkButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[transform,box-shadow,colors,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border border-white/10 bg-gradient-to-b from-white/14 to-white/[0.06] text-foreground shadow-[0_14px_40px_rgb(0_0_0_/0.35)] hover:-translate-y-0.5 hover:border-white/16",
        secondary:
          "border border-border/60 bg-background/40 text-foreground backdrop-blur hover:bg-background/60",
        outline: "border border-border/70 bg-transparent text-foreground hover:bg-muted/30",
        ghost: "text-foreground hover:bg-muted/25",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 rounded-md px-3 text-xs",
        md: "h-10 rounded-md px-5 text-sm",
        lg: "min-h-11 rounded-lg px-7 text-sm sm:text-[0.95rem]",
        icon: "h-10 w-10 rounded-md",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

const platformRing: Record<NetworkPlatform, string> = {
  fi: "hover:border-amber-400/25 hover:shadow-[0_18px_48px_rgb(212_175_55_/0.12)]",
  hairaudit: "hover:border-sky-400/25 hover:shadow-[0_18px_48px_rgb(56_189_248_/0.12)]",
  hli: "hover:border-emerald-400/30 hover:shadow-[0_18px_48px_rgb(16_185_129_/0.12)]",
  iiohr: "hover:border-slate-200/20 hover:shadow-[0_18px_48px_rgb(226_232_240_/0.08)]",
};

export interface NetworkButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof networkButtonVariants> {
  asChild?: boolean;
  /** Optional brand accent hint for hover affordances */
  platform?: NetworkPlatform;
}

export const NetworkButton = React.forwardRef<HTMLButtonElement, NetworkButtonProps>(
  ({ className, variant, size, asChild = false, platform, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const accent = platform ? platformRing[platform] : undefined;
    return (
      <Comp
        className={cn(networkButtonVariants({ variant, size }), variant === "primary" && accent, className)}
        ref={ref}
        {...props}
      />
    );
  }
);
NetworkButton.displayName = "NetworkButton";

export { networkButtonVariants };
