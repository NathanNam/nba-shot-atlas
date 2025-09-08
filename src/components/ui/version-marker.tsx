import { Badge } from "@/components/ui/badge";
import { Code } from "lucide-react";

interface VersionMarkerProps {
  version?: string;
  variant?: "default" | "minimal" | "prominent";
}

export function VersionMarker({ version = "v2.2.1", variant = "default" }: VersionMarkerProps) {
  const baseClasses = "font-mono text-xs transition-all duration-200";
  
  if (variant === "minimal") {
    return (
      <span className={`${baseClasses} text-muted-foreground`}>
        {version}
      </span>
    );
  }
  
  if (variant === "prominent") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-subtle border border-border/50 rounded-lg shadow-sm">
        <Code className="h-3 w-3 text-primary" />
        <span className={`${baseClasses} text-foreground font-medium`}>
          {version}
        </span>
      </div>
    );
  }
  
  return (
    <Badge 
      variant="secondary" 
      className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 transition-colors"
    >
      {version}
    </Badge>
  );
}