# token-radar-entry

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Ann0nn/token-radar-entry/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Ann0nn/token-radar-entry/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar — a dashboard ranking every pre-token protocol in the DefiLlama snapshot by implied value: TVL × a measured market-cap multiple × growth × maturity, with a concrete farm plan for each of the 201 ranked protocols. The base multiple (0.082) is the median market-cap-to-TVL ratio of the snapshot's own 52 token-trading protocols — measured from the data, never hardcoded. Exchanges, bridges and wrapped or staked products are set aside by the model's rule, so the board ranks protocols a reader can actually farm.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=s27wgn68&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
