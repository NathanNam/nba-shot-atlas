// Web Worker for processing large datasets without blocking the main thread
self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'PROCESS_BATCH':
      processBatch(data);
      break;
    case 'AGGREGATE_STATS':
      aggregateStats(data);
      break;
    default:
      console.log('Unknown message type:', type);
  }
};

function processBatch({ batchData, batchIndex, isLastBatch }) {
  try {
    // Transform data efficiently
    const shots = batchData.map(row => ({
      personId: row.personId?.toString() || '',
      teamTricode: row.teamTricode || '',
      xLegacy: parseFloat(row.xLegacy?.toString() || '0'),
      yLegacy: parseFloat(row.yLegacy?.toString() || '0'),
      shotDistance: parseFloat(row.shotDistance?.toString() || '0'),
      shotResult: row.shotResult || '',
      shotValue: parseInt(row.shotValue?.toString() || '2'),
      description: row.description || '',
      subType: row.subType || '',
    }));

    // Send processed batch back to main thread
    self.postMessage({
      type: 'BATCH_PROCESSED',
      data: {
        shots,
        batchIndex,
        isLastBatch,
        processedCount: shots.length
      }
    });
  } catch (error) {
    self.postMessage({
      type: 'BATCH_ERROR',
      data: {
        error: error.message,
        batchIndex
      }
    });
  }
}

function aggregateStats({ allShots }) {
  try {
    const totalShots = allShots.length;
    const madeShots = allShots.filter(shot => shot.shotResult === 'Made').length;
    const threePointAttempts = allShots.filter(shot => shot.shotValue === 3).length;
    const threePointMakes = allShots.filter(shot => shot.shotValue === 3 && shot.shotResult === 'Made').length;
    
    const stats = {
      totalShots,
      madeShots,
      fieldGoalPercentage: totalShots > 0 ? (madeShots / totalShots * 100).toFixed(1) : '0.0',
      threePointAttempts,
      threePointMakes,
      threePointPercentage: threePointAttempts > 0 ? (threePointMakes / threePointAttempts * 100).toFixed(1) : '0.0',
    };

    self.postMessage({
      type: 'STATS_AGGREGATED',
      data: stats
    });
  } catch (error) {
    self.postMessage({
      type: 'STATS_ERROR',
      data: { error: error.message }
    });
  }
}