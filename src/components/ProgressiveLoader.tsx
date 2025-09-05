import { Progress } from "@/components/ui/progress";

interface ProgressiveLoaderProps {
  loaded: number;
  total?: number;
  isProcessing?: boolean;
  title?: string;
}

export function ProgressiveLoader({ loaded, total, isProcessing, title = "Loading" }: ProgressiveLoaderProps) {
  const percentage = total ? Math.round((loaded / total) * 100) : 0;
  const formattedLoaded = loaded.toLocaleString();
  const formattedTotal = total?.toLocaleString();

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-card border border-border rounded-lg shadow-card">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
          <div className="text-sm text-muted-foreground">
            {isProcessing ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span>Processing data...</span>
              </div>
            ) : (
              <span>
                {formattedLoaded} {total && `/ ${formattedTotal}`} shots loaded
              </span>
            )}
          </div>
        </div>
        
        {total && (
          <div className="space-y-2">
            <Progress value={percentage} className="h-2" />
            <div className="text-center text-xs text-muted-foreground">
              {percentage}% complete
            </div>
          </div>
        )}
        
        {!total && (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
    </div>
  );
}