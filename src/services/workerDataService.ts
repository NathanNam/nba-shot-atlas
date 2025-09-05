import { ShotData } from './supabaseDataService';

export interface ProcessingProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export class WorkerDataService {
  private static worker: Worker | null = null;
  private static callbacks: Map<string, (data: any) => void> = new Map();

  static initializeWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker('/workers/dataProcessor.js');
      this.worker.onmessage = (e) => {
        const { type, data } = e.data;
        const callback = this.callbacks.get(type);
        if (callback) {
          callback(data);
        }
      };
    }
    return this.worker;
  }

  static onMessage(type: string, callback: (data: any) => void) {
    this.callbacks.set(type, callback);
  }

  static offMessage(type: string) {
    this.callbacks.delete(type);
  }

  static processLeagueDataProgressive(
    rawData: any[],
    progressCallback?: (progress: ProcessingProgress) => void,
    completionCallback?: (shots: ShotData[]) => void
  ): void {
    const worker = this.initializeWorker();
    const batchSize = 1000;
    const totalBatches = Math.ceil(rawData.length / batchSize);
    let processedBatches = 0;
    let allProcessedShots: ShotData[] = [];

    console.log(`🎯 WorkerDataService: Starting progressive processing of ${rawData.length} records in ${totalBatches} batches`);

    // Set up callbacks
    this.onMessage('BATCH_PROCESSED', ({ shots, batchIndex, isLastBatch, processedCount }) => {
      allProcessedShots.push(...shots);
      processedBatches++;

      if (progressCallback) {
        progressCallback({
          loaded: allProcessedShots.length,
          total: rawData.length,
          percentage: Math.round((allProcessedShots.length / rawData.length) * 100)
        });
      }

      console.log(`🎯 WorkerDataService: Processed batch ${processedBatches}/${totalBatches}, total shots: ${allProcessedShots.length}`);

      if (isLastBatch && completionCallback) {
        console.log(`🎯 WorkerDataService: All batches processed, total: ${allProcessedShots.length} shots`);
        completionCallback(allProcessedShots);
        // Clean up callbacks
        this.offMessage('BATCH_PROCESSED');
        this.offMessage('BATCH_ERROR');
      }
    });

    this.onMessage('BATCH_ERROR', ({ error, batchIndex }) => {
      console.error(`🎯 WorkerDataService: Error processing batch ${batchIndex}:`, error);
    });

    // Process batches with small delays to prevent blocking
    const processBatch = (batchIndex: number) => {
      if (batchIndex >= totalBatches) return;

      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, rawData.length);
      const batchData = rawData.slice(start, end);
      const isLastBatch = batchIndex === totalBatches - 1;

      worker.postMessage({
        type: 'PROCESS_BATCH',
        data: {
          batchData,
          batchIndex,
          isLastBatch
        }
      });

      // Process next batch with a small delay to allow UI updates
      if (!isLastBatch) {
        setTimeout(() => processBatch(batchIndex + 1), 10);
      }
    };

    // Start processing
    processBatch(0);
  }

  static terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.callbacks.clear();
    }
  }
}