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

    // NBA Court dimensions (half court)
    const courtWidth = 500;
    const courtHeight = 470;
    
    // Create court background
    const courtGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    
    // Court background
    const courtBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    courtBg.setAttribute("width", courtWidth.toString());
    courtBg.setAttribute("height", courtHeight.toString());
    courtBg.setAttribute("fill", "hsl(var(--court-background))");
    courtBg.setAttribute("rx", "8");
    courtGroup.appendChild(courtBg);

    // Basketball hoop
    const hoop = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    hoop.setAttribute("cx", (courtWidth / 2).toString());
    hoop.setAttribute("cy", "417.5");
    hoop.setAttribute("r", "9");
    hoop.setAttribute("fill", "none");
    hoop.setAttribute("stroke", "hsl(var(--court-lines))");
    hoop.setAttribute("stroke-width", "2");
    courtGroup.appendChild(hoop);

    // Backboard
    const backboard = document.createElementNS("http://www.w3.org/2000/svg", "line");
    backboard.setAttribute("x1", "220");
    backboard.setAttribute("y1", "422");
    backboard.setAttribute("x2", "280");
    backboard.setAttribute("y2", "422");
    backboard.setAttribute("stroke", "hsl(var(--court-lines))");
    backboard.setAttribute("stroke-width", "4");
    courtGroup.appendChild(backboard);

    // Free throw lane
    const ftLane = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    ftLane.setAttribute("x", "190");
    ftLane.setAttribute("y", "228");
    ftLane.setAttribute("width", "120");
    ftLane.setAttribute("height", "190");
    ftLane.setAttribute("fill", "none");
    ftLane.setAttribute("stroke", "hsl(var(--court-lines))");
    ftLane.setAttribute("stroke-width", "2");
    courtGroup.appendChild(ftLane);

    // Free throw circle
    const ftCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ftCircle.setAttribute("cx", (courtWidth / 2).toString());
    ftCircle.setAttribute("cy", "228");
    ftCircle.setAttribute("r", "60");
    ftCircle.setAttribute("fill", "none");
    ftCircle.setAttribute("stroke", "hsl(var(--court-lines))");
    ftCircle.setAttribute("stroke-width", "2");
    courtGroup.appendChild(ftCircle);

    // Restricted area
    const restrictedArea = document.createElementNS("http://www.w3.org/2000/svg", "path");
    restrictedArea.setAttribute("d", "M 210 417.5 A 40 40 0 0 1 290 417.5");
    restrictedArea.setAttribute("fill", "none");
    restrictedArea.setAttribute("stroke", "hsl(var(--court-lines))");
    restrictedArea.setAttribute("stroke-width", "2");
    courtGroup.appendChild(restrictedArea);

    // Three-point line
    const threePointLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
    threePointLine.setAttribute("d", "M 30 347.5 Q 30 180 250 180 Q 470 180 470 347.5");
    threePointLine.setAttribute("fill", "none");
    threePointLine.setAttribute("stroke", "hsl(var(--court-lines))");
    threePointLine.setAttribute("stroke-width", "3");
    courtGroup.appendChild(threePointLine);

    // Center circle (partial)
    const centerCircle = document.createElementNS("http://www.w3.org/2000/svg", "path");
    centerCircle.setAttribute("d", "M 130 47 A 120 120 0 0 1 370 47");
    centerCircle.setAttribute("fill", "none");
    centerCircle.setAttribute("stroke", "hsl(var(--court-lines))");
    centerCircle.setAttribute("stroke-width", "2");
    courtGroup.appendChild(centerCircle);

    // Court outline
    const courtOutline = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    courtOutline.setAttribute("width", courtWidth.toString());
    courtOutline.setAttribute("height", courtHeight.toString());
    courtOutline.setAttribute("fill", "none");
    courtOutline.setAttribute("stroke", "hsl(var(--court-lines))");
    courtOutline.setAttribute("stroke-width", "3");
    courtOutline.setAttribute("rx", "8");
    courtGroup.appendChild(courtOutline);

    svg.appendChild(courtGroup);

    // Add sample heat map zones (will be replaced with real data)
    const sampleZones = [
      { x: 250, y: 350, intensity: 0.8, made: 15, attempted: 20 },
      { x: 180, y: 300, intensity: 0.6, made: 12, attempted: 25 },
      { x: 320, y: 300, intensity: 0.7, made: 18, attempted: 24 },
      { x: 100, y: 250, intensity: 0.4, made: 8, attempted: 30 },
      { x: 400, y: 250, intensity: 0.5, made: 10, attempted: 22 },
    ];

    sampleZones.forEach((zone, index) => {
      const heatZone = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      heatZone.setAttribute("cx", zone.x.toString());
      heatZone.setAttribute("cy", zone.y.toString());
      heatZone.setAttribute("r", "25");
      
      // Color based on shooting percentage
      const percentage = zone.made / zone.attempted;
      let fill: string;
      if (percentage >= 0.6) {
        fill = "hsl(var(--heat-hot))";
      } else if (percentage >= 0.45) {
        fill = "hsl(var(--heat-warm))";
      } else if (percentage >= 0.35) {
        fill = "hsl(var(--heat-neutral))";
      } else {
        fill = "hsl(var(--heat-cold))";
      }
      
      heatZone.setAttribute("fill", fill);
      heatZone.setAttribute("opacity", "0.7");
      heatZone.setAttribute("class", "transition-all duration-300 hover:opacity-90 cursor-pointer");
      
      // Add tooltip data
      heatZone.setAttribute("data-made", zone.made.toString());
      heatZone.setAttribute("data-attempted", zone.attempted.toString());
      heatZone.setAttribute("data-percentage", (percentage * 100).toFixed(1));

      svg.appendChild(heatZone);
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