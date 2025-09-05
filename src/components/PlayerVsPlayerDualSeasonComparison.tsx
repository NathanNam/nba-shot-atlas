import { PlayerVsPlayerComparison } from "./PlayerVsPlayerComparison";

interface PlayerVsPlayerDualSeasonComparisonProps {
  player1: string;
  player2: string;
  season1: string;
  season2: string;
  viewMode: "player" | "team";
}

export function PlayerVsPlayerDualSeasonComparison({ 
  player1, 
  player2, 
  season1, 
  season2, 
  viewMode 
}: PlayerVsPlayerDualSeasonComparisonProps) {
  return (
    <div className="space-y-8">
      <PlayerVsPlayerComparison
        player1={player1}
        player2={player2}
        season={season1}
        viewMode={viewMode}
      />
      <PlayerVsPlayerComparison
        player1={player1}
        player2={player2}
        season={season2}
        viewMode={viewMode}
      />
    </div>
  );
}