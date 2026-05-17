"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { X } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({ message, onDismiss, className }: ErrorBannerProps) {
  return (
    <Alert variant="destructive" className={`flex items-start justify-between${className ? ` ${className}` : ""}`}>
      <AlertDescription className="flex-1">{message}</AlertDescription>
      {onDismiss && (
        <button onClick={onDismiss} className="ml-4 shrink-0 hover:opacity-70">
          <X className="h-4 w-4" />
        </button>
      )}
    </Alert>
  );
}
