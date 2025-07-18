import { Injectable } from '@nestjs/common';
import { CustomLoggerService } from '../logger/logger.service';
import * as os from 'os';

interface PerformanceMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentUsed: number;
  };
  process: {
    uptime: number;
    pid: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
}

@Injectable()
export class PerformanceMonitoringService {
  private metricsHistory: PerformanceMetrics[] = [];
  private readonly MAX_HISTORY = 100;

  constructor(private readonly logger: CustomLoggerService) {
    // Start monitoring
    this.startMonitoring();
  }

  private startMonitoring() {
    // Collect metrics every minute
    setInterval(() => {
      const metrics = this.collectMetrics();
      this.metricsHistory.push(metrics);

      // Keep only recent history
      if (this.metricsHistory.length > this.MAX_HISTORY) {
        this.metricsHistory.shift();
      }

      // Log if there are performance issues
      this.checkPerformanceIssues(metrics);
    }, 60000); // 1 minute
  }

  private collectMetrics(): PerformanceMetrics {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Calculate CPU usage
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const cpuUsage = 100 - Math.floor((totalIdle / totalTick) * 100);

    return {
      cpu: {
        usage: cpuUsage,
        loadAverage: os.loadavg(),
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        percentUsed: Math.round((usedMemory / totalMemory) * 100),
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        memoryUsage: process.memoryUsage(),
      },
    };
  }

  private checkPerformanceIssues(metrics: PerformanceMetrics) {
    // Check CPU usage
    if (metrics.cpu.usage > 80) {
      this.logger.warn(
        `High CPU usage detected: ${metrics.cpu.usage}%`,
        'Performance',
      );
    }

    // Check memory usage
    if (metrics.memory.percentUsed > 85) {
      this.logger.warn(
        `High memory usage detected: ${metrics.memory.percentUsed}%`,
        'Performance',
      );
    }

    // Check process memory
    const processMemoryMB = metrics.process.memoryUsage.heapUsed / 1024 / 1024;
    if (processMemoryMB > 500) {
      this.logger.warn(
        `High process memory usage: ${processMemoryMB.toFixed(2)}MB`,
        'Performance',
      );
    }
  }

  getMetrics(): PerformanceMetrics {
    return this.collectMetrics();
  }

  getMetricsHistory(): PerformanceMetrics[] {
    return this.metricsHistory;
  }

  getAverageMetrics(): PerformanceMetrics | null {
    if (this.metricsHistory.length === 0) {
      return null;
    }

    const sum = this.metricsHistory.reduce(
      (acc, metric) => ({
        cpu: {
          usage: acc.cpu.usage + metric.cpu.usage,
          loadAverage: acc.cpu.loadAverage.map(
            (val, idx) => val + metric.cpu.loadAverage[idx],
          ),
        },
        memory: {
          total: metric.memory.total,
          used: acc.memory.used + metric.memory.used,
          free: acc.memory.free + metric.memory.free,
          percentUsed: acc.memory.percentUsed + metric.memory.percentUsed,
        },
        process: {
          uptime: metric.process.uptime,
          pid: metric.process.pid,
          memoryUsage: {
            rss: acc.process.memoryUsage.rss + metric.process.memoryUsage.rss,
            heapTotal:
              acc.process.memoryUsage.heapTotal +
              metric.process.memoryUsage.heapTotal,
            heapUsed:
              acc.process.memoryUsage.heapUsed +
              metric.process.memoryUsage.heapUsed,
            external:
              acc.process.memoryUsage.external +
              metric.process.memoryUsage.external,
            arrayBuffers:
              acc.process.memoryUsage.arrayBuffers +
              metric.process.memoryUsage.arrayBuffers,
          },
        },
      }),
      {
        cpu: { usage: 0, loadAverage: [0, 0, 0] },
        memory: { total: 0, used: 0, free: 0, percentUsed: 0 },
        process: {
          uptime: 0,
          pid: 0,
          memoryUsage: {
            rss: 0,
            heapTotal: 0,
            heapUsed: 0,
            external: 0,
            arrayBuffers: 0,
          },
        },
      },
    );

    const count = this.metricsHistory.length;

    return {
      cpu: {
        usage: Math.round(sum.cpu.usage / count),
        loadAverage: sum.cpu.loadAverage.map((val) => val / count),
      },
      memory: {
        total: sum.memory.total,
        used: Math.round(sum.memory.used / count),
        free: Math.round(sum.memory.free / count),
        percentUsed: Math.round(sum.memory.percentUsed / count),
      },
      process: {
        uptime: sum.process.uptime,
        pid: sum.process.pid,
        memoryUsage: {
          rss: Math.round(sum.process.memoryUsage.rss / count),
          heapTotal: Math.round(sum.process.memoryUsage.heapTotal / count),
          heapUsed: Math.round(sum.process.memoryUsage.heapUsed / count),
          external: Math.round(sum.process.memoryUsage.external / count),
          arrayBuffers: Math.round(
            sum.process.memoryUsage.arrayBuffers / count,
          ),
        },
      },
    };
  }
}
