# How well can Licits do? A validation summary

Prepared for the hackathon. Two independent checks: one **measured on real SEAP data**, one a **simulated scenario**. They answer different questions and should not be mixed up.

| | Real data | Simulation |
|---|---|---|
| Question | How big is the market, and does matching work? | How might the market react to the launch? |
| Method | Counts and arithmetic on SEAP awards; back-test of `core/scoring.py` | MiroFish multi-agent simulation (61 agents, 10 rounds) |
| Trust | High for what it measures, small sample for the back-test | Exploratory. Shows scenarios and objections, predicts nothing |

## 1. Real SEAP data

Source: the Licits database, filled by the SEAP sync. 3,756 tenders (14 Aug to 28 Oct 2026) and 771 contract awards (28 Sep to 28 Oct 2026) in CPV divisions 45, 30, 33, 50, 72 and 60. The award window is 30 days, and the sync caps each run, so the figures below are lower bounds on the market.

**Market size (30 days)**
- 538 different companies won at least one award, 771 awards in total.
- Construction works (CPV 45): 176 awards with a named winner, **137 different winners**; only 24 of them won more than once in the month.
- About 490 to 550 new construction tenders are published each month.
- Correction: a first look at these 30 days suggested a median of 35 million RON and 14% of awards under 5 million RON. The sync that filled the database is capped per run, so that sample was biased toward big awards. On a full year of construction awards ([adoption model](ADOPTION_MODEL.md)) the median is 20 million RON, **34% are under 5 million RON** and 13% under 1 million.
- Median offers received is 3, and 23% of construction awards had a single bidder.
- Arithmetic, not a forecast: 100 paying customers on Growth (349 RON a month) are 418,800 RON a year.

**Matching back-test** (`backend/scripts/backtest_matching.py`)

For each company with two or more awards, one award was hidden and a profile was built from the rest (main CPV codes, capacity set to the largest other contract). The hidden award's tender was then ranked among all open tenders with the real scoring code.

- 27 cases, 16 companies.
- **In 67% of cases the tender the company actually won ranked in the top 5%** of about 3,700 tenders (chance would be 5%). Median rank percentile 0.02.
- The score was 45 or higher (the threshold for an AI look) for 44% of won tenders, while only 1.6% of all tenders pass that threshold.
- In 33% of cases the score was zero, because the company had won in a CPV code it had not used before. Matching only exact main CPV codes is the weak spot; counting related CPV codes is the obvious fix.

Limits: small sample, and the profiles are rebuilt from past wins, not the companies' real profiles. Read it as a strong signal, not proof.

## 2. Simulation (MiroFish)

[MiroFish](https://github.com/666ghj/MiroFish) reads a seed document, turns the people and organisations in it into agents with personalities, and lets them interact on simulated social platforms. We gave it a document with the product, the figures above and 61 named archetypes (contractor owners, bid specialists, consultants, accountants, buyers, associations, media, a competitor). The people are invented archetypes, not real firms.

Run: 61 agents, 10 rounds on two platforms, 123 actions in total, using the Meta AI model Licits already uses. Files: [seed](validation/mirofish-seed.md), [full report](validation/mirofish-report.md).

What it concluded:
1. **First adopters** are small contractors chasing tenders under 1 million RON. The owner is both buyer and user, trying it costs little.
2. **Larger firms watch.** They want proof of accuracy, peer results and a pilot before they change process. Mid-sized firms split by how much of the tender work sits on one or two people.
3. **Accuracy becomes the public fight.** One screenshot of a wrong eligibility flag travels faster than an average. Early satisfaction with discovery does not carry over to trust at submission.
4. **Consultants split** into those who see Licits as a multiplier (they bring several clients) and those who see a threat to their fee (they can slow adoption by not recommending it).
5. **Plan choice is a risk decision.** Small firms start on the cheapest monthly plan and upgrade after a real submission. Invite-only works as a trust signal, if cohorts produce visible success stories.
6. **Product implication:** show the paragraph of the tender documents behind each eligibility verdict (source links) and include it in the core paid plan, not only the top one.

How far to trust it: agents are a model's idea of contractors, not measurements, and the seed was written by us, so some of the output echoes our own assumptions. With only 123 actions across 61 agents the interaction is thin. Use it to find objections and scenarios we had not thought of, not to estimate adoption or revenue.

## Conclusion

The real data supports the premise: there are enough distinct winners each month to be a market, competition is thin enough that better preparation matters, and the matching engine puts the tender a company actually won near the top far more often than chance. The weakest points are matching on exact CPV codes, the small number of firms that would plausibly pay (see the [adoption model](ADOPTION_MODEL.md)), and the trust that has to be earned through verifiable accuracy. The simulation points to the same last issue from the market side, which is why source-linked eligibility results are the next item on the to-do list in the README.
