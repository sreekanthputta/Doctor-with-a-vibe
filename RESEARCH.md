# OnePractice Research and Product Decision

Research checked August 1, 2026.

> **Document role:** supporting research, not the normative specification. Resolve conflicts in this order: `AGENTS.md` → `HACKATHON.md` → `ARCHITECTURE.md` → `UI.md`/`DEEPGRAM.md` → `BUILD_PLAN.md` → this file.

## Executive decision

The strongest product direction is an **AI operations layer for independent outpatient practices**, with Medplum as the source of truth and a Cursor-like physician cockpit.

The credible promise is not “replace every hospital employee.” It is:

> **A front office in software; humans handle clinical care and exceptions.**

The best hackathon wedge is **one call to one ready visit**. It demonstrates scheduling, intake, missing-information follow-up, optional eligibility, a physician exception inbox, and a visible Medplum graph in one coherent loop. Encounter transcription, clinical chat, referrals, and revenue-cycle automation are logical expansions after the core loop works.

## Why the broad vision needs a wedge

The need is real, but the category is crowded. Tebra, athenaOne, and Elation already market integrated practice/EHR platforms; Assort and Luma cover patient access and conversational operations. “AI receptionist” or “all-in-one EHR” alone is not a winning distinction.

The defensible angle is a **FHIR-native, coverage-aware operations queue that resolves routine work end to end and gives the physician one safe exception inbox**. The product should be measured by completed workflows, correct escalation, and zero re-entry—not how human the bot sounds.

Independent practice is also a meaningful customer story. AMA reports that 42.2% of physicians were in private practice in 2024, down from 60.1% in 2012, and identifies administrative burden and costly resources among the pressures behind consolidation.

## Who does what in an outpatient practice

This is a product boundary, not legal advice. State scope-of-practice, delegation, consent, and recording law varies; specialty and payer policy may be stricter.

| Function | Automate under published rules | Require review/exception handling | Human/licensed/physical work |
| --- | --- | --- | --- |
| Front desk | Approved FAQs, demographics, forms, routine slots, reminders, waitlist | uncertain identity, proxy/minor, interpreter, unusual visit, overbooking | symptom urgency or care disposition |
| Medical assistant/intake | collect patient-reported history, medication names, forms, trusted-device data | chart reconciliation, abnormal values, forms needing medical judgment | examination, specimen collection, injections, manual vitals, clinical assessment |
| Referral coordinator | document routing, missing-artifact requests, benefits checks, status tracking | destination, payer requirement interpretation, PA packet, closure | referral need, specialty, urgency, order, medical necessity |
| Scribe | consented transcription, speaker separation, draft sections and fields | every clinical note and structured chart fact | verify accuracy/omissions, medical decision-making, final signature |
| Biller/coder | eligibility, claim status, ERA posting, deterministic edits, draft candidates | claim, modifiers, diagnosis linkage, appeals/corrections | final certification and ambiguous coding |
| Nurse/telephone triage | collect symptoms verbatim; replay signed patient-specific instructions | callback drafts or visible protocol suggestions | assessment, disposition, medication advice, result interpretation |
| Care coordination/inbox | reminders, logistics, categorization, assignment, SLA tracking | symptom/result/medication replies | patient-specific advice and clinical escalation |
| Practice/compliance | audit dashboards, access expiry, queue aging, standard reports | disclosures, amendments, retention exceptions, protocol publication | governance, incident response, legal/risk decisions |
| Physician cockpit | cited read-only chart retrieval and operational summaries | every clinical communication or mutation proposal | diagnosis, interpretation, orders, prescribing, consent, final note |

The practical target is not zero humans. It is a radically lean team where humans spend time on judgment, touch, empathy, and exceptions.

## Candidate projects

| Project | Demo | Strength | Main weakness | Verdict |
| --- | --- | --- | --- | --- |
| **OnePractice Ready Visit** | call/web request → appointment → intake → missing-field follow-up → physician inbox | clearest end-to-end story; deep Medplum fit; safe and measurable | scheduling beta and identity edge cases | **Build this** |
| Closed-Loop Referral Front Desk | referral arrives → packet completion → patient booking → receipt tracking | strong specialist-practice pain; great FHIR graph | external transmission and clinical urgency add risk | best second workflow |
| Result Rescue | result enters queue → patient contact → acknowledged follow-up | patient-safety narrative and clear closure | clinical escalation is hard; weaker sponsor fit | strong safety-track alternative |
| AuthReady | existing order → eligibility/evidence packet → administrative task | payer ROI and natural Stedi fit | policy/authorization claims are easy to overstate | good back-office expansion |
| Encounter Diff | consented transcript → structured draft → physician approval | visually magical “Cursor for doctors” moment | crowded scribe market; wrong-patient and silent-write risk | stretch scene only |
| Medication-aware chart search | question → record facts + cited references | useful physician cockpit feature | crosses into regulated/unsafe recommendation quickly | retrieval-only roadmap |
| Careflow Studio | text workflow → typed FHIR plan → tests → publish | ambitious platform novelty | meta-tool demo before proving a customer outcome | final platform reveal, not MVP |

## Winning demo rationale

OnePractice Ready Visit wins the internal review because it provides:

- one human-readable outcome: the visit is operationally ready;
- Medplum depth across scheduling, patient, coverage, questionnaire, task, communication, and provenance;
- a natural optional Stedi test transaction;
- a voice path without depending on live telephony;
- an obvious before/after metric: manual touches and unresolved exceptions;
- a trust moment where the system stops safely;
- a credible startup wedge for greenfield independent practices.

The internal reviewers rejected the full clinic vision as a one-day build. The security/demo reviewer gave a conditional go only after narrowing live dependencies, locking patient context, removing autonomous medication/referral behavior, and enforcing typed approval-gated mutations.

## Vendor architecture review

| Layer | Role | Authoritative for | Not authoritative for | Hackathon use |
| --- | --- | --- | --- | --- |
| OnePractice | policy, workflow state machine, approvals, idempotency, exceptions, UI | workflow decisions made under published rules | clinical facts or payer responses | core product |
| Medplum | FHIR clinical and operational record | patients, appointments, forms, chart, orders, tasks, committed claim representation | live payer processing state | only required live dependency |
| Stedi | payer/clearinghouse transactions | response returned by a payer/clearinghouse at a timestamp | coverage guarantee, coding, medical necessity, fee schedules | labeled eligibility test fixture/API |
| Deepgram | conversational speech, Think/LLM output, function proposals, and transcription | provider events and finalized transcript output from the selected model | identity, workflow authority, authorization, triage, or clinical judgment | optional shared live voice/chat interface; deterministic typed fallback bypasses it |
| Moss | low-latency semantic search index | public versioned medication-label chunks only in a future benchmark | patient facts, permissions, safety decisions, interactions, availability, eligibility, balances, or claim status | excluded from administrative MVP; conditional medication-evidence roadmap |

Stedi's current published catalog supports eligibility and benefits, insurance discovery, coordination of benefits, professional/institutional/dental claims, claim attachments, 277CA acknowledgments, 276/277 claim-status checks, and 835 remittance responses. However, test API keys currently support approved real-time eligibility fixtures; production payer transactions require a production account, appropriate BAA/account controls, enrollment where applicable, and operational reconciliation. Claims are roadmap, not part of the judged demo.

For eligibility, `Coverage` represents the patient policy. The canonical demo graph uses FHIR `CoverageEligibilityRequest` and `CoverageEligibilityResponse`, with an identifier/reference to the original Stedi transaction or labeled fixture artifact. Do not turn the result into a boolean `verified` field. Stedi owns the external response; Medplum stores a timestamped normalized projection, source identifier, and freshness/reconciliation state.

Moss was evaluated and rejected for the administrative MVP. The first slice needs exact patient-, tenant-, resource-, and status-scoped Medplum queries, not semantic retrieval. A later medication-evidence experiment is materially different: index only public, versioned DailyMed label sections and retrieve by normalized drug/product plus section, without patient facts or identifiers. Add it only after recall, latency, token, version, deletion, and failure benchmarks beat direct authoritative retrieval without weakening traceability.

Deepgram is not a telephone or SMS network. A production phone number still needs a PSTN/telephony adapter, call state, consent, transfer, delivery, retry, and failure handling. Browser voice or prerecorded audio is the honest hackathon channel.

## Clinical-chat boundary

The physician should be able to ask questions over a selected patient, but the initial product must behave as **record-aware retrieval**, not an autonomous medical authority.

For a question such as “Can I suggest paracetamol?” the UI can provide:

- the current medication list and its freshness;
- recorded allergies/adverse reactions;
- relevant conditions, labs, and missing information;
- normalized drug identity using RxNorm;
- source-linked official labeling or practice references;
- a transparent explanation of which inputs were considered and which were not checked.

It should not simply answer yes/no, invent an interaction, select a dose, or create a prescription. FDA’s January 2026 CDS guidance emphasizes that the healthcare professional must be able to independently review the basis of a recommendation and not rely primarily on the software. RxNorm normalizes drug identity; it is not itself a complete interaction or prescribing engine. DailyMed exposes current structured product labeling, not patient-specific medical judgment.

The future evidence pipeline is deliberately layered:

1. Normalize the spoken/typed candidate to product and ingredients with RxNorm.
2. Fetch exact authorized patient facts from Medplum; preserve status, source, version, and freshness.
3. Run only checks backed by validated medication knowledge sources, and enumerate unavailable checks.
4. Ask Moss several section-scoped public-label queries; never send patient facts or chart text into Moss.
5. Revalidate each returned DailyMed `setId`, version, section, and current/archived status before display.
6. Return an evidence review containing candidate identity, patient facts used, missing data, alerts, checked/unavailable checks, and citations. The only allowed action is clinician review.

DailyMed's v2 web services expose current SPL information, product-level RxCUIs, label documents, and version history; bulk label releases are also available. DailyMed is not complete for every FDA-regulated product and is not a comprehensive drug-interaction database. NLM states that RxNav's drug-interaction feature was discontinued on January 2, 2024, so it must not be used as the proposed interaction engine.

## Recording and extraction architecture

Use two separate Deepgram paths:

| Use | Recommended path | Important constraint |
| --- | --- | --- |
| Front-desk voice/chat agent | Deepgram Voice Agent; audio or `InjectUserMessage` through one session | its function requests remain untrusted and require the OnePractice policy dispatcher |
| Doctor-patient encounter | Nova streaming/batch with diarization, utterances, keyterms | interim text is display-only; finalized transcript remains a source, not a chart fact |

The browser may connect to Deepgram with a narrowly scoped short-lived token issued by an authenticated server-side endpoint; the permanent provider key must never enter browser code. Use only synthetic audio for the hackathon, make recording state visible, do not persist raw audio by default, and keep logs free of transcript payloads. The deterministic typed path bypasses Deepgram entirely but emits the same validated intent schema.

The durable flow is:

```text
consented source audio
  -> finalized speaker-attributed transcript
  -> strict extraction schema
  -> patient-locked proposal and source-linked diff
  -> clinician edit/accept/reject
  -> atomic version-aware FHIR transaction
  -> Provenance and audit trail
```

If a record changes after the proposal was generated, invalidate and rebase the proposal. Never silently overwrite a signed note or problem list. Corrected content should preserve the prior version, author, source, and reason.

## Safety red lines

- Never reveal PHI until identity/proxy authority is verified.
- Never infer that caller ID identifies a patient.
- Never let an LLM be the sole triage or emergency control.
- Never reassure, diagnose, recommend treatment, or choose a disposition when a caller expresses symptoms.
- Never start, stop, substitute, refill, or change a medication or dose autonomously.
- Never treat patient-reported or transcribed content as reconciled fact.
- Never allow transcript, fax, chart narrative, or upload instructions to invoke tools.
- Never let generated documentation automatically justify generated billing codes.
- Never infer referral urgency, destination, medical necessity, or completion.
- Never interpret eligibility as authorization, network status, guaranteed coverage, or price.
- Never mark a referral closed because a fax was sent; require receipt and appropriate follow-up.
- Never promise that a physician will immediately see an exception; show hours, ownership, and acknowledgment state.

## Quantified pain and pitch metrics

Use external numbers only to establish scale, not to promise product outcomes:

- BLS describes medical secretaries as scheduling appointments, billing patients, and compiling/recording charts and reports; medical-records specialists validate and maintain accurate health information.
- Primary-care EHR studies have found substantial time spent on desktop medicine and EHR work per encounter.
- AMA reports major prior-authorization workload; CAQH reports very high eligibility/benefit transaction volume and remaining electronic savings opportunity.

Measure the product directly with:

- percentage of administrative calls completed without staff;
- manual re-entry events per visit;
- intake completeness before appointment;
- referral-to-booking and missing-document resolution time;
- waitlist backfill/no-show rate;
- exception acknowledgment SLA;
- clinician inbox minutes;
- eligibility/claim-status minutes avoided;
- duplicate, wrong-patient, and unreviewed-clinical-write count.

Do not claim an eliminated FTE, fewer adverse events, increased revenue, fewer denials, or accurate clinical triage without a real pilot.

## Questions for sponsors

### Medplum

1. Which scheduling beta operations and status pattern are most reliable in the hosted hackathon project?
2. What is the preferred pattern for a proposed AI extraction awaiting clinician approval?
3. Can accepted resources, a completed review `Task`, and `Provenance` be committed atomically in one transaction?
4. Which audit trail can a hackathon app query and display?
5. Are Bots/subscriptions enabled, and should we avoid depending on them for the demo?
6. Which questionnaire-to-resource extraction pattern do you recommend for patient-reported intake?

### Stedi

1. Which eligibility test fixture is approved and which fields are guaranteed to appear?
2. Does test mode count for sponsor-track judging?
3. What exact wording should distinguish returned benefits from price, network, authorization, and coverage guarantees?
4. Which later workflows—claim status, claims, prior authorization—require production access and should not be claimed in the demo?

### Deepgram

1. Which Voice Agent Think/listen/speak models do you recommend for browser front-desk turn-taking, and which separate model for a future two-speaker clinical encounter?
2. What least-privilege scopes and maximum TTL should our browser token endpoint issue, and can tokens be bound to a session or origin?
3. Does `InjectUserMessage` always invoke Speak/TTS, is that billed when playback is muted, and is there a supported per-turn or per-session text-only mode?
4. What conversation and function-call context must be supplied after reconnect, and how should duplicate or in-flight function calls be handled?
5. What retention/model-improvement settings should be used for synthetic hackathon audio and later PHI, and what PHI redaction is not supported?

### Moss — roadmap validation, not an MVP dependency

1. Can an index be built and queried entirely locally from our approved public corpus without sending query text or telemetry to managed infrastructure?
2. How are exact metadata filters, version replacement, deletions, cache invalidation, and offline updates enforced?
3. What benchmark tooling can measure required-section recall, p95 latency, and token reduction against direct DailyMed retrieval?
4. What logging, retention, encryption, tenant isolation, export, and deletion controls apply even when the intended corpus is public?
5. What DailyMed redistribution or packaging constraints must we satisfy before distributing an index?

### Judges/organizers

1. Is voice mandatory or one possible interface?
2. How are real functionality, Medplum depth, sponsor usage, novelty, safety, and startup potential weighted?
3. Are deterministic fixtures acceptable as stage fallbacks when the live integration is also demonstrated separately?
4. Is the preferred pitch a narrow deployed workflow or a broader platform with one reliable vertical slice?

## Primary sources

- [YC x Medplum Hackathon](https://events.ycombinator.com/medplum-hackathon-26)
- [Medplum scheduling](https://www.medplum.com/docs/scheduling)
- [Medplum appointment booking](https://www.medplum.com/docs/scheduling/appointment-book)
- [Medplum intake](https://www.medplum.com/docs/intake)
- [Medplum charting](https://www.medplum.com/docs/charting)
- [Medplum referrals](https://www.medplum.com/docs/careplans/referrals)
- [Medplum clinical protocols](https://www.medplum.com/docs/careplans/protocols)
- [Medplum AI guidance](https://www.medplum.com/docs/ai)
- [FDA Clinical Decision Support Software guidance, January 2026](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software)
- [NLM RxNorm](https://www.nlm.nih.gov/research/umls/rxnorm/index.html)
- [RxNorm APIs](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html)
- [RxNav FAQ and interaction-feature notice](https://lhncbc.nlm.nih.gov/RxNav/information/FAQs.html)
- [DailyMed web services](https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm)
- [DailyMed bulk drug labels](https://dailymed.nlm.nih.gov/dailymed/spl-resources-all-drug-labels.cfm)
- [Moss on Y Combinator](https://www.ycombinator.com/companies/moss)
- [Deepgram Browser Agent overview](https://developers.deepgram.com/docs/browser-agent-overview)
- [Deepgram Inject User](https://developers.deepgram.com/docs/voice-agent-inject-user-message)
- [Deepgram FunctionCallRequest](https://developers.deepgram.com/docs/voice-agent-function-call-request)
- [Deepgram FunctionCallResponse](https://developers.deepgram.com/docs/voice-agent-function-call-response)
- [Deepgram function-call context](https://developers.deepgram.com/docs/voice-agent-function-call-context)
- [Deepgram diarization](https://developers.deepgram.com/docs/diarization)
- [Deepgram redaction](https://developers.deepgram.com/docs/redaction)
- [NCSBN delegation guidance](https://www.ncsbn.org/public-files/NGND-PosPaper_06.pdf)
- [CMS signature requirements](https://www.cms.gov/files/document/mln905364-complying-medicare-signature-requirements.pdf)
- [HHS appointment reminder privacy guidance](https://www.hhs.gov/hipaa/for-professionals/faq/286/are-appointment-reminders-allowed-under-hipaa-without-authorization/index.html)
- [HHS voicemail guidance](https://www.hhs.gov/hipaa/for-professionals/faq/198/may-health-care-providers-leave-messages/index.html)
- [AMA physician practice benchmark](https://www.ama-assn.org/about/ama-research/physician-practice-benchmark-survey)
- [BLS medical records specialists](https://www.bls.gov/ooh/healthcare/medical-records-and-health-information-technicians.htm)
- [BLS secretaries and administrative assistants](https://www.bls.gov/ooh/office-and-administrative-support/secretaries-and-administrative-assistants.htm)
- [Stedi eligibility workflows](https://www.stedi.com/docs/healthcare/eligibility-workflows-overview)
- [Stedi healthcare APIs](https://www.stedi.com/docs/healthcare)
- [Stedi claim submission overview](https://www.stedi.com/docs/healthcare/intro-to-claim-submission)
- [Stedi healthcare API reference](https://www.stedi.com/docs/healthcare/api-reference)
- [Stedi account settings and test environment](https://www.stedi.com/docs/healthcare/account-settings)
- [FHIR R4 CoverageEligibilityRequest](https://hl7.org/fhir/R4/coverageeligibilityrequest.html)
- [FHIR R4 CoverageEligibilityResponse](https://hl7.org/fhir/R4/coverageeligibilityresponse.html)
- [FHIR R4 QuestionnaireResponse](https://hl7.org/fhir/R4/questionnaireresponse.html)
- [FHIR R4 Communication](https://hl7.org/fhir/R4/communication.html)

## Reviewer configuration provenance

The repository reviewer agents follow ECC’s narrow, read-only, evidence-first pattern, adapted to the current Codex custom-agent schema. ECC was inspected at commit `e4e4163101f162881e628f300a9ca4e6a940bcea`.

- [ECC Codex configuration](https://github.com/affaan-m/ECC/blob/e4e4163101f162881e628f300a9ca4e6a940bcea/.codex/config.toml)
- [ECC reviewer agents](https://github.com/affaan-m/ECC/tree/e4e4163101f162881e628f300a9ca4e6a940bcea/.codex/agents)
