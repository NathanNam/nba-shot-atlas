import { useRef, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ShotData } from "@/services/supabaseDataService";

interface ShotChartProps {
  title: string;
  data?: ShotData[];
  width?: number;
  height?: number;
  progress?: { loaded: number; total?: number; isProcessing?: boolean } | null;
}

type ViewMode = "shots" | "heatmap";

export function ShotChart({ title, data, width = 500, height = 470, progress }: ShotChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("shots");

  console.log(`🔍 ShotChart DEBUG - ${title}:`, {
    dataLength: data?.length || 0,
    hasData: !!data,
    title
  });

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    svg.innerHTML = ''; // Clear previous content

    // NBA Court dimensions based on R code (scaled for SVG)
    // Original: width=50, height=47, but we scale by 10 for better resolution
    const scale = 10;
    const courtWidth = 50 * scale;  // 500
    const courtHeight = 47 * scale; // 470
    const centerX = courtWidth / 2;
    
    // Court dimensions from R code (scaled)
    const keyHeight = 19 * scale;
    const innerKeyWidth = 12 * scale;
    const outerKeyWidth = 16 * scale;
    const backboardWidth = 6 * scale;
    const backboardOffset = 4 * scale;
    const neckLength = 0.5 * scale;
    const hoopRadius = 0.75 * scale;
    const hoopCenterY = courtHeight - (backboardOffset + neckLength + hoopRadius);
    const threePointRadius = 23.75 * scale;
    const threePointSideRadius = 22 * scale;
    const threePointSideHeight = 14 * scale;
    const restrictedRadius = 4 * scale;
    
    // Create court background
    const courtGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    
    // Court background
    const courtBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    courtBg.setAttribute("width", courtWidth.toString());
    courtBg.setAttribute("height", courtHeight.toString());
    courtBg.setAttribute("fill", "hsl(var(--court-background))");
    courtBg.setAttribute("rx", "8");
    courtGroup.appendChild(courtBg);

    // Court perimeter
    const courtPerimeter = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    courtPerimeter.setAttribute("width", courtWidth.toString());
    courtPerimeter.setAttribute("height", courtHeight.toString());
    courtPerimeter.setAttribute("fill", "none");
    courtPerimeter.setAttribute("stroke", "hsl(var(--court-lines))");
    courtPerimeter.setAttribute("stroke-width", "2");
    courtPerimeter.setAttribute("rx", "8");
    courtGroup.appendChild(courtPerimeter);

    // Outer key (paint area)
    const outerKey = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    outerKey.setAttribute("x", (centerX - outerKeyWidth / 2).toString());
    outerKey.setAttribute("y", (courtHeight - keyHeight).toString());
    outerKey.setAttribute("width", outerKeyWidth.toString());
    outerKey.setAttribute("height", keyHeight.toString());
    outerKey.setAttribute("fill", "none");
    outerKey.setAttribute("stroke", "hsl(var(--court-lines))");
    outerKey.setAttribute("stroke-width", "2");
    courtGroup.appendChild(outerKey);

    // Backboard
    const backboard = document.createElementNS("http://www.w3.org/2000/svg", "line");
    backboard.setAttribute("x1", (centerX - backboardWidth / 2).toString());
    backboard.setAttribute("y1", (courtHeight - backboardOffset).toString());
    backboard.setAttribute("x2", (centerX + backboardWidth / 2).toString());
    backboard.setAttribute("y2", (courtHeight - backboardOffset).toString());
    backboard.setAttribute("stroke", "hsl(var(--court-lines))");
    backboard.setAttribute("stroke-width", "4");
    courtGroup.appendChild(backboard);

    // Neck (connects backboard to hoop)
    const neck = document.createElementNS("http://www.w3.org/2000/svg", "line");
    neck.setAttribute("x1", centerX.toString());
    neck.setAttribute("y1", (courtHeight - backboardOffset).toString());
    neck.setAttribute("x2", centerX.toString());
    neck.setAttribute("y2", (courtHeight - backboardOffset - neckLength).toString());
    neck.setAttribute("stroke", "hsl(var(--court-lines))");
    neck.setAttribute("stroke-width", "2");
    courtGroup.appendChild(neck);

    // Basketball hoop
    const hoop = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    hoop.setAttribute("cx", centerX.toString());
    hoop.setAttribute("cy", hoopCenterY.toString());
    hoop.setAttribute("r", hoopRadius.toString());
    hoop.setAttribute("fill", "none");
    hoop.setAttribute("stroke", "hsl(var(--court-lines))");
    hoop.setAttribute("stroke-width", "2");
    courtGroup.appendChild(hoop);

    // Free throw circle (top half)
    const ftCircleTop = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const ftCircleY = courtHeight - keyHeight;
    const ftCircleRadius = innerKeyWidth / 2;
    ftCircleTop.setAttribute("d", `M ${centerX - ftCircleRadius} ${ftCircleY} A ${ftCircleRadius} ${ftCircleRadius} 0 0 1 ${centerX + ftCircleRadius} ${ftCircleY}`);
    ftCircleTop.setAttribute("fill", "none");
    ftCircleTop.setAttribute("stroke", "hsl(var(--court-lines))");
    ftCircleTop.setAttribute("stroke-width", "2");
    courtGroup.appendChild(ftCircleTop);

    // Free throw circle (bottom dashed semicircle)
    const ftCircleBottom = document.createElementNS("http://www.w3.org/2000/svg", "path");
    ftCircleBottom.setAttribute("d", `M ${centerX - ftCircleRadius} ${ftCircleY} A ${ftCircleRadius} ${ftCircleRadius} 0 0 0 ${centerX + ftCircleRadius} ${ftCircleY}`);
    ftCircleBottom.setAttribute("fill", "none");
    ftCircleBottom.setAttribute("stroke", "hsl(var(--court-lines))");
    ftCircleBottom.setAttribute("stroke-width", "2");
    ftCircleBottom.setAttribute("stroke-dasharray", "5,5");
    courtGroup.appendChild(ftCircleBottom);

    // Restricted area (charge circle)
    const restrictedArea = document.createElementNS("http://www.w3.org/2000/svg", "path");
    restrictedArea.setAttribute("d", `M ${centerX - restrictedRadius} ${hoopCenterY} A ${restrictedRadius} ${restrictedRadius} 0 0 1 ${centerX + restrictedRadius} ${hoopCenterY}`);
    restrictedArea.setAttribute("fill", "none");
    restrictedArea.setAttribute("stroke", "hsl(var(--court-lines))");
    restrictedArea.setAttribute("stroke-width", "2");
    courtGroup.appendChild(restrictedArea);

    // Three-point line
    const threePointLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const threePointY = courtHeight - threePointSideHeight;
    // Left straight line - extend to baseline
    let pathD = `M ${centerX - threePointSideRadius} ${courtHeight} L ${centerX - threePointSideRadius} ${threePointY}`;
    // Arc (sweep flag 1 to curve toward baseline)
    pathD += ` A ${threePointRadius} ${threePointRadius} 0 0 1 ${centerX + threePointSideRadius} ${threePointY}`;
    // Right straight line - extend to baseline
    pathD += ` L ${centerX + threePointSideRadius} ${courtHeight}`;
    
    threePointLine.setAttribute("d", pathD);
    threePointLine.setAttribute("fill", "none");
    threePointLine.setAttribute("stroke", "hsl(var(--court-lines))");
    threePointLine.setAttribute("stroke-width", "3");
    courtGroup.appendChild(threePointLine);

    // Center circle (partial - only the part visible in half court)
    const centerCircle = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const centerCircleRadius = 6 * scale; // Center circle radius
    centerCircle.setAttribute("d", `M ${centerX - centerCircleRadius} 0 A ${centerCircleRadius} ${centerCircleRadius} 0 0 1 ${centerX + centerCircleRadius} 0`);
    centerCircle.setAttribute("fill", "none");
    centerCircle.setAttribute("stroke", "hsl(var(--court-lines))");
    centerCircle.setAttribute("stroke-width", "2");
    courtGroup.appendChild(centerCircle);

    svg.appendChild(courtGroup);

    // Render shot data based on view mode
    if (data && data.length > 0) {
      if (viewMode === "shots") {
        // Individual shots view - render all shots
        data.forEach((shot, index) => {
          const shotCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          
          const svgX = centerX + (shot.xLegacy * scale / 10);
          const svgY = hoopCenterY - (shot.yLegacy * scale / 10);
          
          const isMade = shot.shotResult === 'Made';
          
          shotCircle.setAttribute("cx", svgX.toString());
          shotCircle.setAttribute("cy", svgY.toString());
          shotCircle.setAttribute("r", "3");
          shotCircle.setAttribute("fill", isMade ? "hsl(var(--heat-hot))" : "hsl(var(--heat-cold))");
          shotCircle.setAttribute("stroke", isMade ? "#22c55e" : "#ef4444");
          shotCircle.setAttribute("stroke-width", "0.5");
          shotCircle.setAttribute("opacity", "0.7");
          shotCircle.setAttribute("class", "transition-all duration-300 hover:opacity-100 cursor-pointer");
          
          shotCircle.setAttribute("data-shot-key", `${shot.personId || 'unknown'}-${index}`);
          shotCircle.setAttribute("data-player", shot.personId?.toString() || 'unknown');
          shotCircle.setAttribute("data-shot-type", shot.subType || '');
          shotCircle.setAttribute("data-distance", shot.shotDistance?.toString() || '0');
          shotCircle.setAttribute("data-description", shot.description || '');
          
          svg.appendChild(shotCircle);
        });
      } else {
        // Heat map view
        renderHeatMap(data, svg, centerX, hoopCenterY, scale);
      }
    }

  }, [data, viewMode]);

  // Heat map rendering function
  const renderHeatMap = (shots: ShotData[], svg: SVGSVGElement, centerX: number, hoopCenterY: number, scale: number) => {
    const hexSize = 12; // Size of hexagons
    const hexGrid = new Map<string, { made: number; total: number; x: number; y: number }>();
    
    // Bin shots into hexagonal grid
    shots.forEach(shot => {
      const x = centerX + (shot.xLegacy * scale / 10);
      const y = hoopCenterY - (shot.yLegacy * scale / 10);
      
      // Calculate hex grid position
      const hexX = Math.round(x / (hexSize * 1.5)) * (hexSize * 1.5);
      const hexY = Math.round(y / (hexSize * Math.sqrt(3) / 2)) * (hexSize * Math.sqrt(3) / 2);
      const key = `${hexX},${hexY}`;
      
      if (!hexGrid.has(key)) {
        hexGrid.set(key, { made: 0, total: 0, x: hexX, y: hexY });
      }
      
      const bin = hexGrid.get(key)!;
      bin.total += 1;
      if (shot.shotResult === 'Made') {
        bin.made += 1;
      }
    });
    
    // Render hexagons
    hexGrid.forEach(bin => {
      if (bin.total < 3) return; // Skip bins with too few shots
      
      const percentage = bin.made / bin.total;
      const leagueAvg = 0.46; // Approximate league average FG%
      const efficiency = percentage - leagueAvg;
      
      // Color based on efficiency vs league average
      let fillColor: string;
      let opacity: number;
      
      if (efficiency > 0.15) {
        fillColor = "hsl(220, 85%, 25%)"; // Dark blue - much better
        opacity = 0.9;
      } else if (efficiency > 0.05) {
        fillColor = "hsl(220, 75%, 35%)"; // Medium dark blue - better
        opacity = 0.8;
      } else if (efficiency > -0.05) {
        fillColor = "hsl(220, 65%, 45%)"; // Medium blue - average
        opacity = 0.6;
      } else if (efficiency > -0.15) {
        fillColor = "hsl(220, 55%, 55%)"; // Light blue - worse
        opacity = 0.5;
      } else {
        fillColor = "hsl(220, 45%, 65%)"; // Very light blue - much worse
        opacity = 0.4;
      }
      
      // Create hexagon path
      const hexPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const hexagonPath = createHexagonPath(bin.x, bin.y, hexSize);
      
      hexPath.setAttribute("d", hexagonPath);
      hexPath.setAttribute("fill", fillColor);
      hexPath.setAttribute("opacity", opacity.toString());
      hexPath.setAttribute("stroke", "hsl(var(--court-lines))");
      hexPath.setAttribute("stroke-width", "0.5");
      hexPath.setAttribute("class", "transition-all duration-300 hover:opacity-100 cursor-pointer");
      
      // Add data attributes for tooltip
      hexPath.setAttribute("data-percentage", (percentage * 100).toFixed(1));
      hexPath.setAttribute("data-made", bin.made.toString());
      hexPath.setAttribute("data-total", bin.total.toString());
      hexPath.setAttribute("data-efficiency", (efficiency * 100).toFixed(1));
      hexPath.setAttribute("data-league-avg", (leagueAvg * 100).toFixed(1));
      
      // Add hover events for tooltip
      hexPath.addEventListener("mouseenter", (e) => {
        showTooltip(e, {
          playerPercentage: (percentage * 100).toFixed(1),
          leagueAverage: (leagueAvg * 100).toFixed(1),
          made: bin.made,
          total: bin.total,
          efficiency: (efficiency * 100).toFixed(1)
        });
      });
      
      hexPath.addEventListener("mouseleave", hideTooltip);
      
      svg.appendChild(hexPath);
    });
  };

  // Tooltip functions
  const showTooltip = (event: MouseEvent, data: {
    playerPercentage: string;
    leagueAverage: string;
    made: number;
    total: number;
    efficiency: string;
  }) => {
    const tooltip = document.getElementById("shot-chart-tooltip") || createTooltip();
    
    tooltip.innerHTML = `
      <div class="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <div class="text-sm font-semibold text-foreground">${data.playerPercentage}% (${data.made}/${data.total})</div>
        <div class="text-xs text-muted-foreground">League Avg: ${data.leagueAverage}%</div>
        <div class="text-xs ${parseFloat(data.efficiency) >= 0 ? 'text-green-500' : 'text-red-500'}">
          ${parseFloat(data.efficiency) >= 0 ? '+' : ''}${data.efficiency}% vs avg
        </div>
      </div>
    `;
    
    tooltip.style.display = "block";
    tooltip.style.left = (event.pageX + 10) + "px";
    tooltip.style.top = (event.pageY - 10) + "px";
  };

  const hideTooltip = () => {
    const tooltip = document.getElementById("shot-chart-tooltip");
    if (tooltip) {
      tooltip.style.display = "none";
    }
  };

  const createTooltip = () => {
    const tooltip = document.createElement("div");
    tooltip.id = "shot-chart-tooltip";
    tooltip.style.position = "absolute";
    tooltip.style.zIndex = "1000";
    tooltip.style.pointerEvents = "none";
    tooltip.style.display = "none";
    document.body.appendChild(tooltip);
    return tooltip;
  };

  // Helper function to create hexagon path
  const createHexagonPath = (centerX: number, centerY: number, size: number): string => {
    const angles = [0, 60, 120, 180, 240, 300];
    const points = angles.map(angle => {
      const radian = (angle * Math.PI) / 180;
      const x = centerX + size * Math.cos(radian);
      const y = centerY + size * Math.sin(radian);
      return `${x},${y}`;
    });
    
    return `M ${points[0]} L ${points.slice(1).join(' L ')} Z`;
  };

  // Helper function to sample array efficiently  
  const sampleArray = <T,>(array: T[], sampleSize: number): T[] => {
    if (array.length <= sampleSize) return array;
    
    const step = array.length / sampleSize;
    const sampled: T[] = [];
    
    for (let i = 0; i < sampleSize; i++) {
      const index = Math.floor(i * step);
      sampled.push(array[index]);
    }
    
    return sampled;
  };

  return (
    <Card className="p-3 sm:p-6 bg-card border-border shadow-card">
      {/* Mobile-optimized header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-fluid-heading text-foreground">{title}</h3>
        <div className="flex items-center justify-between sm:justify-end">
          <div className="flex items-center space-x-2">
            <Label htmlFor="view-mode" className="text-sm font-medium">Heat Map</Label>
            <Switch
              id="view-mode"
              checked={viewMode === "heatmap"}
              onCheckedChange={(checked) => setViewMode(checked ? "heatmap" : "shots")}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        </div>
      </div>
      
      {/* Loading state with progress */}
      {(!data || data.length === 0) && progress ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="animate-pulse text-muted-foreground">
            {progress.isProcessing ? 'Processing data...' : 
             progress.loaded ? `Loading: ${progress.loaded.toLocaleString()} shots loaded` :
             'Loading shot data...'}
          </div>
          {progress.total && (
            <div className="w-64 bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${(progress.loaded / progress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      ) : (!data || data.length === 0) ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading shot data...</div>
        </div>
      ) : (
        <>
          {/* Responsive shot chart container */}
          <div className="flex justify-center mb-4">
            <div className="w-full max-w-lg sm:max-w-2xl">
              <svg
                ref={svgRef}
                width="100%"
                height="auto"
                viewBox={`0 0 ${width} ${height}`}
                className="border border-border rounded-lg shadow-court w-full h-auto touch-manipulation"
                style={{ aspectRatio: `${width}/${height}` }}
              />
            </div>
          </div>
          
          {/* Mobile-optimized legend */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-6 pt-4 border-t border-border">
            {viewMode === "shots" ? (
              <div className="grid grid-cols-2 gap-3 w-full sm:w-auto sm:flex sm:gap-6">
                <div className="flex items-center gap-2 justify-center">
                  <div 
                    className="w-4 h-4 rounded-full border border-green-500 flex-shrink-0" 
                    style={{ backgroundColor: "hsl(var(--heat-hot))" }}
                  />
                  <span className="text-sm font-medium text-muted-foreground">Made Shot</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <div 
                    className="w-4 h-4 rounded-full border border-red-500 flex-shrink-0" 
                    style={{ backgroundColor: "hsl(var(--heat-cold))" }}
                  />
                  <span className="text-sm font-medium text-muted-foreground">Missed Shot</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full sm:w-auto sm:flex sm:gap-6">
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-4 h-4 rounded-full bg-blue-600 flex-shrink-0"/>
                  <span className="text-sm font-medium text-muted-foreground">Above League Avg</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-4 h-4 rounded-full bg-blue-300 flex-shrink-0"/>
                  <span className="text-sm font-medium text-muted-foreground">Below League Avg</span>
                </div>
              </div>
            )}
            {data && data.length > 0 && (
              <div className="text-xs text-muted-foreground ml-4">
                {data.length} total shots
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}