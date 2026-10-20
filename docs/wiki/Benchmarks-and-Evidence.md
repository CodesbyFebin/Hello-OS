# HELLO OS benchmarks and evidence policy

HELLO OS does not currently claim verified microVM startup, service-level uptime, market pricing, or universal AML token savings. A performance statement belongs in project documentation only when it can be reproduced from a published method, tested revision, workload, environment, and measured result.

## Claims to treat as proposals

The repository's vision materials may mention targets such as 50 ms starts, 74.5% token reduction, sub-cent operations, or high availability. These are not measurements of the current prototype. The project does not implement Firecracker microVM execution, a production payment rail, or hosted SLA monitoring.

## Minimum benchmark record

| Field | Record |
| --- | --- |
| Revision | Full commit SHA and build configuration. |
| Environment | CPU, memory, OS, runtime versions, storage, network, and relevant flags. |
| Workload | Input corpus, request shape, concurrency, warm/cold definition, and exclusions. |
| Method | Tool and version, measurement boundaries, repetitions, and aggregation method. |
| Results | Raw observations, units, sample count, dispersion, and failures/timeouts. |
| Comparison | Same environment and workload for every compared implementation. |
| Limitations | What the test does not establish and whether data is synthetic. |

## AML token comparison

The AML API's lexical token count is deterministic under its documented counting rule. Estimated JSON/Python equivalents are not measured using a vendor tokenizer. For a defensible comparison, publish the exact AML and equivalent programs, canonicalization procedure, tokenizer name/version, input set, counts, and calculation. Avoid generalizing one task's result to all agent workflows.

## Report template

```markdown
## Result
- Claim tested:
- Commit:
- Environment:
- Workload and sample count:
- Method/tool versions:
- Raw data:
- Summary statistic and uncertainty:
- Failures and exclusions:
- Reproduction steps:
- Limitations:
```

Open a GitHub Discussion under the benchmark category only after the test has been run. Distinguish measured results, estimates, and design targets. Corrections should retain the original context and link to the updated method.
