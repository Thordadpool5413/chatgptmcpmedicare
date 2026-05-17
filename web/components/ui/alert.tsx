import { cn } from "@/lib/utils";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "warning";
}

export function Alert({ className, variant = "default", ...props }: AlertProps) {
  const variants = {
    default: "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] border-[hsl(var(--border))]",
    destructive: "bg-red-50 text-red-900 border-red-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
  };
  return (
    <div
      role="alert"
      className={cn("relative w-full rounded-lg border p-4 text-sm", variants[variant], className)}
      {...props}
    />
  );
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 leading-relaxed", className)} {...props} />;
}
