# Cloud 9 — regulatory ceiling and the evidence against the brief

Researched 2026-08-24. This is the document to read before design decisions, not after.
Two things in here are legal exposure, and one is a direct challenge to the whole
scroll-journey concept. Both need Tom's decision, not mine.

---

## 1. ⚠ THE REGULATORY CEILING IS LOWER THAN THE AESTHETICS

**UK medical cannabis is a STRICTER advertising regime than Botox, not a looser one.**

- Only **three** cannabis products are UK-licensed: Epidyolex, Nabilone, Sativex (nabiximols).
  *(NHS, reviewed 2022-05-27)* Everything else a private clinic prescribes is an **unlicensed
  "special."**
- **Human Medicines Regulations 2012 reg 279:** you may not advertise an unlicensed medicine
  **at all**. **Reg 284:** you may not publish anything "likely to lead to the use of a
  prescription-only medicine" to the public.
  → An unlicensed CBPM is hit by **both**. *(legislation.gov.uk, Part 14)*
- **MHRA:** *"A breach of medicine advertising regulations is a criminal offence with a
  possible penalty of a fine and imprisonment for up to 2 years."* *(gov.uk, upd. 2025-04-11)*
- **MHRA is actively enforcing against clinic websites right now** — June 2026 investigations
  named Infusion Therapy London, The Medispa, Tesco Pharmacy (caught for **indirect**
  references likely to prompt a POM request), The Harper Clinic.
- **What IS permitted, in MHRA's own words:** *"Treatment-service providers may promote the
  service or consultation offered."* **Design the site around the consultation and the
  clinician. Never around the medicine.** This is exactly what the current captions already do
  — that instinct was right.

**ASA / CAP Code — the rules that will actually be ruled on:**
- **12.12:** POMs may not be advertised to the public.
- **Homepage: no POM references at all** — not in headlines, small print, price lists, logos,
  testimonials or hover text. *"Casually browsing consumers should not easily encounter POM
  information."* Inner pages may carry balanced factual info as an outcome of consultation.
- **Frame the consultation, not the product** — "a consultation for X" is fine; naming the
  medicine is not.
- **12.10: must not suggest something is safe or effective because it is "natural."**
  ⚠ This bites a botanical brief hard — "plant medicine", "natural relief", and botanical
  imagery used *as an efficacy claim*.
- **12.18:** no celebrity or health-professional endorsement of medicines.
- **No before/after imagery** for POMs. No guaranteed results. No countdown/limited-time offers.
- **CAP "Drugs" guidance:** anything reading as recreational — "high", "euphoria",
  "elevation", leaf or smoke iconography — is a live Code risk independent of the POM rules.
  ⚠ Note this cuts at the brand name's own pun. Keep the site's register clinical.

**The live enforcement risk in this exact niche is competitor-reported CLAIMS, not aesthetics.**
The only ASA ruling against a UK medical cannabis clinic — **Mamedica, 2026-01-28, UPHELD** —
was brought by rival clinic Releaf over a price comparison, and breached seven rules on
misleadingness plus 3.34 (unverifiable: no methodology, no dates, no sources).
→ **Every number on this site needs a dated, linked, verifiable methodology.** Rivals are
policing each other.

**CQC Regulation 20A is a hard LAYOUT constraint:** if the client holds a CQC rating they must
display it **by law**, on the website, **"clear and conspicuous"**, within 21 days of
publication. A full-bleed cinematic journey cannot bury it or animate it away.
**Plan the slot before designing the journey.** *(cqc.org.uk)*

**GAP — someone must check by hand:** gmc-uk.org blocks automated fetching, so **no GMC
guidance was retrieved**. Its advertising/honesty and cosmetic-interventions paragraphs
interlock with the CAP code. Open it in a browser before client sign-off.

---

## 2. ⚠⚠ THE EVIDENCE SAYS THE SCROLL JOURNEY MAY HURT THIS AUDIENCE

This is the uncomfortable part, and it is better to know it now.

**Nielsen Norman Group names MEDICAL explicitly as a genre where scroll-triggered animation
hurts.** *(nngroup.com/articles/scroll-animations, 2017-04-16)* Their split: it helps on
leisure sites (entertainment, art, ecommerce); it hurts on task-focused sites — and they name
medical alongside financial and B2B. Study quote: *"I don't like how everything comes together
when I'm scrolling down… I hate that it has to load every single section."* Their conclusion:
*"Task-focused users don't want to be wowed by a website — they want to get answers."*
Their three rules if you do it: match context, apply to **secondary** content only (never the
main body), and trigger **once per session**, not on every scroll-back.

**The vestibular problem, which is specific and serious here.**
WCAG 2.2 SC 2.3.3 names **parallax scrolling** as a primary concern. Documented impacts:
*"nausea, migraine headaches, and potentially needing bed rest to recover."*
**The UK medical-cannabis patient population is disproportionately chronic pain, MS, epilepsy
and migraine.** A parallax scroll-journey can symptom-trigger the exact people it is meant to
convert. This is not a checkbox — for this clinic it is close to the centre of the brief.

**Three large studies converge, and they do not support "beautiful = trusted":**
- Sillence et al., JMIR 2011, **n=561**: information quality and impartiality were the direct
  predictors of trust. **"Credible design" was not.**
- Sillence et al., JMIR 2019, **n=1,123**: only credibility-and-impartiality had a significant
  direct effect on trust (β=.79).
- Sillence et al., JMIR Infodemiology 2025, **n=525**: same result again (β=.82).
- Stanford's 2,684-person credibility study: design was the most-cited factor overall (46.1%),
  but **health scored BELOW average (41.8%)** on design-driven credibility — and their expert
  companion study found the more expert the audience, the less polish carries. Chronic-condition
  patients become expert fast.
- Stanford Guideline #6 is "professional visual design." Guideline **#9 is "minimise
  promotional content."** A cinematic hero maximises the promotional register. These are in
  tension and #9 is the one a regulator reads.
- Prototypicality research (Electronic Markets, 2025): conforming to **genre convention**
  measurably improves attitudes in high-stakes categories. Leaving the genre has a cost the
  novelty must pay back.

**The honest counterweight:** Robins/Holmes/Stansbury (JASIST 2010) rated 31 real health sites
and found visual-design preference did correlate significantly with credibility ratings. It is
correlational, and it is the strongest pro-design evidence available.

**Also verified by direct measurement of the competition (2026-08-24):**
- **6/6 major UK medical cannabis clinics** (Mamedica, Releaf, Curaleaf, Alternaleaf, Integro,
  Lyphe) carry video. **0/6 load any cinematic motion stack** — no GSAP, no ScrollTrigger, no
  Lenis, no WebGL. The entire category is conventional funnel design.
- **No UK medical cannabis clinic has ever been recognised by Awwwards.**
- 84% of award-nominated *health* sites ship video; only 52% ship a motion stack.
- Releaf's approach to the POM problem: cannabis products are **never named and never shown** —
  copy stays at "cannabis products", "medical cannabis flower". No strain names, no product
  imagery. That is the compliant pattern, and it is what our product-free plates already do.
- ⚠ Do **not** use the recreational-cannabis visual canon (Awwwards' cannabis category is
  North American lifestyle/CPG brands) as reference. Its entire vocabulary — lifestyle, mood,
  product hero shots — is what reg 279/284 and CAP "Drugs" forbid.

---

## 3. WHAT THIS MEANS FOR THE BUILD

**The white space is real** — nobody in the UK category is doing this — but it may be unoccupied
partly for reasons, and the honest position to sell the client is:

> **Cinematic motion is a differentiation and memorability play, not a trust play.**

Trust comes from named clinicians with real portraits (NN/g eyetracking: real staff portraits
got 10% more dwell than longer bios in far more space; decorative people-photos are ignored
outright), the CQC rating displayed properly, **external** reviews rather than on-site
testimonials, and impartial factual content. The journey earns attention; those elements earn
the enquiry. Both have to be there.

**The design consequence, and it is not a fallback:**
Build so the whole thing **strips to a plain, fast, scannable document** — because a
Reduce-Motion user, a task-focused patient in pain, and the compliance reviewer all need that
version to exist and to be complete. It is a first-class deliverable, not a graceful
degradation.

⚠ **And Tom's own Mac has Reduce Motion ON** — so whatever that path renders is what *he* sees,
and headless Chrome reports "reduce" too. Anything gated behind `prefers-reduced-motion` is
invisible to him during review unless he checks deliberately.
