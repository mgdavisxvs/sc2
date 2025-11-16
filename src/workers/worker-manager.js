/**
 * Web Worker Manager
 * Manages worker lifecycle and provides Promise-based API
 */

export class WorkerManager {
  constructor(workerPath, workerCount = 1) {
    this.workerPath = workerPath;
    this.workerCount = workerCount;
    this.workers = [];
    this.currentWorkerIndex = 0;
    this.pendingTasks = new Map();
    this.taskIdCounter = 0;
    this.initialized = false;
  }

  /**
   * Initialize workers
   */
  async init() {
    if (this.initialized) {
      return;
    }

    const initPromises = [];

    for (let i = 0; i < this.workerCount; i++) {
      const worker = new Worker(this.workerPath, { type: 'module' });

      const initPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 5000);

        worker.addEventListener('message', (event) => {
          if (event.data.status === 'ready') {
            clearTimeout(timeout);
            resolve();
          } else {
            this.handleMessage(event);
          }
        });

        worker.addEventListener('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.workers.push(worker);
      initPromises.push(initPromise);
    }

    await Promise.all(initPromises);
    this.initialized = true;
  }

  /**
   * Handle worker message
   */
  handleMessage(event) {
    const { id, status, result, error } = event.data;

    const task = this.pendingTasks.get(id);
    if (!task) {
      console.warn('Received message for unknown task:', id);
      return;
    }

    this.pendingTasks.delete(id);

    if (status === 'success') {
      task.resolve(result);
    } else {
      task.reject(new Error(error || 'Worker task failed'));
    }
  }

  /**
   * Execute task on worker
   */
  async execute(type, data, transferables = []) {
    if (!this.initialized) {
      await this.init();
    }

    const taskId = this.taskIdCounter++;
    const worker = this.getNextWorker();

    return new Promise((resolve, reject) => {
      // Store task
      this.pendingTasks.set(taskId, { resolve, reject });

      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingTasks.delete(taskId);
        reject(new Error('Worker task timeout'));
      }, 30000); // 30 second timeout

      // Override reject to clear timeout
      const originalReject = reject;
      reject = (error) => {
        clearTimeout(timeout);
        originalReject(error);
      };

      const originalResolve = resolve;
      resolve = (result) => {
        clearTimeout(timeout);
        originalResolve(result);
      };

      this.pendingTasks.set(taskId, { resolve, reject });

      // Send message to worker
      worker.postMessage(
        {
          id: taskId,
          type,
          data,
        },
        transferables
      );
    });
  }

  /**
   * Get next worker (round-robin)
   */
  getNextWorker() {
    const worker = this.workers[this.currentWorkerIndex];
    this.currentWorkerIndex = (this.currentWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  /**
   * Execute task on all workers in parallel
   */
  async executeAll(type, dataArray, transferables = []) {
    if (!this.initialized) {
      await this.init();
    }

    const promises = dataArray.map((data, index) => {
      const worker = this.workers[index % this.workers.length];
      const taskId = this.taskIdCounter++;

      return new Promise((resolve, reject) => {
        this.pendingTasks.set(taskId, { resolve, reject });

        worker.postMessage(
          {
            id: taskId,
            type,
            data,
          },
          transferables
        );
      });
    });

    return Promise.all(promises);
  }

  /**
   * Terminate all workers
   */
  terminate() {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.pendingTasks.clear();
    this.initialized = false;
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      workerCount: this.workers.length,
      pendingTasks: this.pendingTasks.size,
    };
  }
}

/**
 * MRTS Worker Manager (singleton)
 */
let mrtsWorkerManager = null;

export function getMRTSWorker() {
  if (!mrtsWorkerManager) {
    mrtsWorkerManager = new WorkerManager('/src/workers/mrts-worker.js', 2);
  }
  return mrtsWorkerManager;
}

/**
 * Calculate MRTS using Web Worker
 */
export async function calculateMRTSAsync(builds, input1, input2) {
  const worker = getMRTSWorker();
  return worker.execute('calculateMRTS', { builds, input1, input2 });
}

/**
 * Generate isoquant using Web Worker
 */
export async function generateIsoquantAsync(outputMetric, targetOutput, possibleBuilds) {
  const worker = getMRTSWorker();
  return worker.execute('generateIsoquant', {
    outputMetric,
    targetOutput,
    possibleBuilds,
  });
}

/**
 * Batch MRTS calculations
 */
export async function batchMRTSAsync(builds, inputPairs) {
  const worker = getMRTSWorker();
  return worker.execute('batchMRTS', { builds, inputPairs });
}

/**
 * Performance monitor for worker tasks
 */
export class WorkerPerformanceMonitor {
  constructor() {
    this.metrics = {
      taskCount: 0,
      totalTime: 0,
      averageTime: 0,
      taskTimes: [],
    };
  }

  async measure(workerFn, ...args) {
    const start = performance.now();

    try {
      const result = await workerFn(...args);
      const duration = performance.now() - start;

      this.recordMetric(duration);

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(duration, true);
      throw error;
    }
  }

  recordMetric(duration, isError = false) {
    this.metrics.taskCount++;
    this.metrics.totalTime += duration;
    this.metrics.averageTime = this.metrics.totalTime / this.metrics.taskCount;

    this.metrics.taskTimes.push({ duration, isError, timestamp: Date.now() });

    // Keep only last 100 tasks
    if (this.metrics.taskTimes.length > 100) {
      this.metrics.taskTimes.shift();
    }
  }

  getMetrics() {
    const successTimes = this.metrics.taskTimes
      .filter((t) => !t.isError)
      .map((t) => t.duration);

    return {
      ...this.metrics,
      successCount: successTimes.length,
      errorCount: this.metrics.taskTimes.filter((t) => t.isError).length,
      minTime: Math.min(...successTimes),
      maxTime: Math.max(...successTimes),
      medianTime: this.getMedian(successTimes),
    };
  }

  getMedian(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  reset() {
    this.metrics = {
      taskCount: 0,
      totalTime: 0,
      averageTime: 0,
      taskTimes: [],
    };
  }
}
