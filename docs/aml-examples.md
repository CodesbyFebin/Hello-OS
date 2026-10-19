# HELLO OS AML examples

AML currently has a **static parser and validator**. Compilation produces an AST, an inspectable intent graph, declared budgets, diagnostics, and SHA-256 content hashes. It never invokes the named operations.

## Mission with a conditional branch

```aml
mission optimize_sql {
  input: $query_id
  budget: 0.42 credits
  deadline: 5m

  steps {
    fetch: db.query($query_id) → $query
    analyze: query.performance($query) → $metrics
    optimize: $metrics → $new_query

    if $new_query.latency < 50ms {
      persist: $new_query → db
      emit: verification_receipt
    } else {
      rollback: checkpoint("pre_optimize")
      emit: dead_end_receipt
    }
  }
}
```

## Capability composition

```aml
capability fullstack_deploy {
  requires: [code_gen, test_gen, run, deploy]

  flow {
    code_gen($spec) → $code
    test_gen($code) → $tests
    run($tests) → $results

    if $results.pass {
      deploy($code) → $receipt
    } else {
      retry(code_gen, $results.feedback)
    }
  }
}
```

## Memory query

```aml
memory recall_auth_architecture {
  filter {
    when: "last 7 days"
    topic: "authentication"
    confidence: >= 0.85
    source: [episodic, semantic]
  }

  budget: 1500 tokens

  return {
    facts: true
    context: true
    related_decisions: true
    dead_ends: true
  }
}
```

## Model matrix and agent bridge declarations

These declarations are parsed as static configuration. They do not connect to a provider or framework, guarantee a provider's retention policy, or perform model arbitration.

```aml
model_matrix local_first {
  lane_fast: [ollama/llama, local/qwen]
  policy {
    max_cost_per_step: 0.002 USD
    fallback: automatic_on_5xx
  }
}

bridge external_agent {
  protocol: a2a
  identity: $agent_did
}
```

## Compile endpoint

Send JSON to `POST /api/aml/compile`:

```json
{"source":"mission example {\n  steps {\n    verify: proof.check($input) → $result\n  }\n}"}
```

Successful compilation returns `ok: true`, `executable: false`, the AST, intent graph, budgets, a deterministic `programHash`, SHA-256 hashes, lexical token metrics, and a receipt schema. Invalid AML returns diagnostics with HTTP 422. `POST /api/aml/validate` returns a smaller validation report and checks every operation called from a `capability` flow against that capability's `requires` list. These endpoints only parse and validate source; they do not execute operations.

`amlTokens` is a deterministic comment-stripped lexical count. JSON and Python comparison figures are explicitly labeled estimates based on canonical AST projections; they are not counts from a model vendor tokenizer and do not promise a billing-token reduction. `tokenizer` identifies the stable counting rule used by this API.

## Execution boundary

An AML operation name is data. The compiler does not execute shell commands, deploy infrastructure, spend wallet balances, mutate memory, call MCP servers, or accept arbitrary JavaScript. Connecting execution requires a separate allowlisted capability registry, authorization checks, resource limits, exact-action approval where needed, and durable receipts. Never treat a source hash as a digital signature or proof that an operation succeeded.
