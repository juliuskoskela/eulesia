# Performance Patterns

Allocation discipline, hot/cold path separation, benchmarking, and
optimization strategies for the Eulesia v2 server.

## The golden rule

**Measure before optimizing. Optimize the hot path. Leave the cold path readable.**

Most code in the Eulesia server doesn't need performance tuning — axum and
tokio are fast by default. But the message relay path (encrypted envelope
receive → store → fan-out → deliver) is latency-sensitive.

## Hot path vs cold path

### Identify the hot path

The hot path is code that executes on every message, every WebSocket frame,
every database query in a request pipeline. The cold path is startup,
configuration, error formatting, migration running.

```rust
// HOT: runs on every message relay (microsecond budget)
fn relay_envelope(envelope: &Envelope, recipients: &[DeviceId]) -> Vec<DeliveryTask> {
    recipients.iter()
        .map(|device_id| DeliveryTask { device_id: *device_id, payload: envelope.ciphertext.clone() })
        .collect()
}

// COLD: runs once at startup (millisecond budget is fine)
async fn load_config(path: &Path) -> Result<Config> {
    let content = std::fs::read_to_string(path)?;
    let config: Config = toml::from_str(&content)?;
    info!("loaded config from {}", path.display());
    Ok(config)
}
```

### Rules for the hot path

1. **Minimize allocation**: Reuse buffers where possible
2. **No format strings**: Use pre-computed labels
3. **Minimize branching**: Early returns, not nested ifs
4. **No locks in the critical section**: Pre-snapshot or lock-free

### Rules for the cold path

1. **Prioritize clarity**: Allocations and format strings are fine
2. **Don't optimize what runs once**: Startup, config, error reporting
3. **Use `String` freely**: The cold path is for humans

## Allocation discipline

### Pre-allocated buffers

```rust
pub struct MessageRelay {
    delivery_buffer: Vec<DeliveryTask>,  // reused across relays
}

impl MessageRelay {
    pub fn relay(&mut self, envelope: &Envelope, recipients: &[DeviceId]) -> &[DeliveryTask] {
        self.delivery_buffer.clear();  // reuse allocation
        for device_id in recipients {
            self.delivery_buffer.push(DeliveryTask {
                device_id: *device_id,
                payload: envelope.ciphertext.clone(),
            });
        }
        &self.delivery_buffer
    }
}
```

### `Cow` at API boundaries

```rust
use std::borrow::Cow;

pub fn log_event(msg: Cow<'_, str>) {
    tracing::info!("{msg}");
}

// Common case: zero-copy
log_event(Cow::Borrowed("message relayed"));

// Rare case: formatted
log_event(Cow::Owned(format!("relay failed for device {device_id}")));
```

## Data structure choices

### Vec vs HashMap for small N

For collections under ~50 elements, linear scan of a `Vec` often beats
`HashMap` due to cache locality. Benchmark your specific case.

### Flat structures over nested pointers

```rust
// BAD: pointer-chasing
struct Group { members: Vec<Box<Member>> }

// GOOD: contiguous memory
struct Group { members: Vec<Member> }
```

## Benchmarking

### What to benchmark

- **Always**: Message relay/fanout path
- **Always**: Database query patterns for common operations
- **Sometimes**: Serialization of hot types (envelope encoding)
- **Never**: Startup code, config parsing, migration running

### Criterion setup

```rust
use criterion::{criterion_group, criterion_main, Criterion};

fn bench_relay(c: &mut Criterion) {
    let envelope = test_envelope();
    let recipients: Vec<DeviceId> = (0..100).map(|_| DeviceId::new()).collect();

    c.bench_function("relay_100_devices", |b| {
        b.iter(|| relay_envelope(&envelope, &recipients))
    });
}

criterion_group!(benches, bench_relay);
criterion_main!(benches);
```

### Benchmark discipline

- Run on the same hardware, same load
- Use `criterion`'s statistical analysis
- Benchmark with realistic data sizes
- Compare against a baseline

## Profiling workflow

1. **Profile first**: `cargo flamegraph` or `samply`
2. **Identify the hotspot**: Usually 1–3 functions account for 80% of time
3. **Measure baseline**: `criterion` benchmark
4. **Optimize**: Apply patterns above
5. **Measure again**: Verify improvement
6. **Check for regressions**: Run the full benchmark suite

Don't skip step 1. Intuition about where time is spent is usually wrong.
