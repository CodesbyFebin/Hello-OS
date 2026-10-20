# Agent Machine Language (AML): static compiler and validation API

HELLO OS AML is a small declarative syntax that the repository can parse into an abstract syntax tree and intent graph. The compiler checks supported syntax, emits diagnostics and content hashes, and provides deterministic lexical metrics. AML is **not executable**: it cannot call a tool, run shell commands, deploy infrastructure, or spend a wallet balance.

## Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/aml/compile` | `POST` | Parse source and return compilation output and diagnostics. |
| `/api/aml/validate` | `POST` | Validate static structure and declared capability dependencies. |

Invalid input returns structured diagnostics. Consult the route handlers for exact request and response schemas; these can evolve with the code.

## Example

```aml
mission example {
  steps {
    inspect: source.read($path) → $result
    emit: validation_receipt
  }
}
```

The names in this example are syntax and graph data. They are not registered execution capabilities. See [`docs/aml-examples.md`](https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/aml-examples.md) and [`docs/aml-spec.ebnf`](https://github.com/CodesbyFebin/Hello-OS/blob/main/docs/aml-spec.ebnf) for accepted examples and grammar.

## Output and metrics

The compiler returns a parsed representation, validation diagnostics, an intent graph, content hashes, and lexical token metrics. The hash is derived from source/program content; it is not a digital signature, execution attestation, or proof of a successful side effect.

AML token count is a deterministic lexical count. Any JSON or Python comparison is an estimate from canonicalized projections, not a count from a model vendor's tokenizer. It does not establish billing savings or a universal compression percentage. To make an independent comparison, publish the source, canonical equivalents, tokenizer and version, test cases, and results.

## Validation tests

Run the repository test suite for the current static behavior:

```sh
npm run test:aml
```

Tests establish behavior for tested cases at the checked-out revision; they do not prove that arbitrary operations execute safely. For execution, a separate system would need an allowlisted capability registry, authorization, resource bounds, approvals for consequential actions, and durable receipts. None is supplied by the AML compiler.
