import { useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";

interface ShotChartProps {
  title: string;
  data?: any; // Will be replaced with actual shot data structure
  width?: number;
  height?: number;
}

export function ShotChart({ title, data, width = 500, height = 470 }: ShotChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

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

    // Add sample shot data (coordinate system: center court = (0,0), scale by 10)
    const sampleShots = [
      { x: 0, y: 5, made: true },     // Close to basket
      { x: -8, y: 15, made: true },   // Left side mid-range
      { x: 12, y: 18, made: false },  // Right side mid-range
      { x: -15, y: 8, made: true },   // Left paint
      { x: 18, y: 12, made: false },  // Right mid-range
      { x: 0, y: 25, made: true },    // Top of key
      { x: -20, y: 25, made: false }, // Left three
      { x: 22, y: 28, made: true },   // Right three
      { x: 8, y: 35, made: false },   // Above the break
      { x: -12, y: 30, made: true },  // Wing three
    ];

    sampleShots.forEach((shot) => {
      const shotCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      // Convert coordinates (center origin to top-left SVG origin)
      const svgX = centerX + (shot.x * scale);
      const svgY = courtHeight - (shot.y * scale);
      
      shotCircle.setAttribute("cx", svgX.toString());
      shotCircle.setAttribute("cy", svgY.toString());
      shotCircle.setAttribute("r", "4");
      shotCircle.setAttribute("fill", shot.made ? "hsl(var(--heat-hot))" : "hsl(var(--heat-cold))");
      shotCircle.setAttribute("stroke", shot.made ? "#22c55e" : "#ef4444");
      shotCircle.setAttribute("stroke-width", "1");
      shotCircle.setAttribute("opacity", "0.8");
      shotCircle.setAttribute("class", "transition-all duration-300 hover:opacity-100 cursor-pointer");
      
      svg.appendChild(shotCircle);
    });

  }, [data]);

  return (
    <Card className="p-6 bg-card border-border shadow-card">
      <h3 className="text-lg font-semibold text-foreground mb-4 text-center">{title}</h3>
      <div className="flex justify-center">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="border border-border rounded-lg shadow-court"
        />
      </div>
    </Card>
  );
}