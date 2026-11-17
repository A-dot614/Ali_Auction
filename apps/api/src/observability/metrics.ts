/**
 * D4 (Slice 10): in-process metrics registry, Prometheus text output.
 * Labels are restricted to stable, non-identifying values; user ids, emails and
 * free text are rejected at the registry boundary.
 */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const EMAIL = /@/;
const FREE_TEXT = /\s/;

export type Labels = Record<string, string>;

export function assertSafeLabel(name: string, value: string): void {
  if (UUID.test(value) || EMAIL.test(value) || FREE_TEXT.test(value) || value.length > 40) {
    throw new Error(`VALIDATION_ERROR: Unsafe label ${name}.`);
  }
}

function key(name: string, labels: Labels): string {
  const sorted = Object.keys(labels).sort().map((k) => `${k}=${labels[k]}`).join(",");
  return `${name}{|${sorted}}`;
}

export class MetricsRegistry {
  private counters = new Map<string, { name: string; labels: Labels; value: number }>();
  private histograms = new Map<string, { name: string; labels: Labels; values: number[] }>();
  private gauges = new Map<string, { name: string; value: number }>();

  increment(name: string, labels: Labels = {}, by = 1): void {
    for (const [k, v] of Object.entries(labels)) assertSafeLabel(k, v);
    const id = key(name, labels);
    const entry = this.counters.get(id) ?? { name, labels, value: 0 };
    entry.value += by;
    this.counters.set(id, entry);
  }

  observe(name: string, value: number, labels: Labels = {}): void {
    for (const [k, v] of Object.entries(labels)) assertSafeLabel(k, v);
    const id = key(name, labels);
    const entry = this.histograms.get(id) ?? { name, labels, values: [] };
    entry.values.push(value);
    this.histograms.set(id, entry);
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, { name, value });
  }

  private formatLabels(labels: Labels): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return "";
    return `{${entries.map(([k, v]) => `${k}="${v}"`).join(",")}}`;
  }

  render(): string {
    const lines: string[] = [];
    for (const entry of this.counters.values()) {
      lines.push(`# TYPE ${entry.name} counter`);
      lines.push(`${entry.name}${this.formatLabels(entry.labels)} ${entry.value}`);
    }
    for (const entry of this.histograms.values()) {
      lines.push(`# TYPE ${entry.name} histogram`);
      const buckets = [10, 50, 100, 500, 1000, 5000];
      for (const le of buckets) {
        const count = entry.values.filter((v) => v <= le).length;
        lines.push(`${entry.name}_bucket{le="${le}"} ${count}`);
      }
      lines.push(`${entry.name}_bucket{le="+Inf"} ${entry.values.length}`);
      lines.push(`${entry.name}_sum ${entry.values.reduce((a, b) => a + b, 0)}`);
      lines.push(`${entry.name}_count ${entry.values.length}`);
    }
    for (const entry of this.gauges.values()) {
      lines.push(`# TYPE ${entry.name} gauge`);
      lines.push(`${entry.name} ${entry.value}`);
    }
    return `${lines.join("\n")}\n`;
  }
}

export const metrics = new MetricsRegistry();

export function recordBidOutcome(outcome: string, registry: MetricsRegistry = metrics): void {
  if (outcome !== "accepted" && outcome !== "rejected") {
    throw new Error("VALIDATION_ERROR: Invalid bid outcome label.");
  }
  registry.increment("bid_outcomes_total", { outcome });
}

export function recordConsumerFailure(consumer: string, registry: MetricsRegistry = metrics): void {
  registry.increment("consumer_batch_failures_total", { consumer });
}
