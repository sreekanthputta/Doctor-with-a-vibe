# OneCare Clinic Product Frame

> Normative priority: subordinate to `AGENTS.md` and the `HACKATHON.md` release contract. This file defines the fictional customer, long-term product story, and roadmap scenario; it does not expand the judged demo.

## Product and customer

- **OnePractice** is the software platform.
- **OneCare Clinic** is the fictional customer and demo practice.
- **Dr. Maya Chen** is a fictional board-certified family physician.
- **Maria Lopez**, age 52, is the single fictional adult patient used across the administrative MVP and later clinical roadmap.

The strongest positioning is:

> One physician runs an AI-native, virtual-first adult primary-care microclinic without dedicated administrative staff.

The stage headline may be:

> A clinic with one human—the doctor.

Immediately clarify that this is not a hospital and not a claim that healthcare requires only one person. The physician provides clinical judgment and accountability; laboratories, imaging facilities, pharmacies, specialists, urgent care, emergency departments, and other licensed/physical services remain human-operated external partners.

## Physician and specialty

OneCare serves adults 18 and older. Dr. Chen practices family medicine with a focus on adult preventive care and cardiometabolic health. The product story may cover, within the physician's credentials, jurisdiction, available data, and care setting:

- preventive and annual wellness care;
- hypertension, type 2 diabetes, dyslipidemia, and obesity management;
- medication review and refill workflows;
- low-acuity outpatient complaints;
- longitudinal monitoring;
- referrals and coordination across external services.

Family medicine supports the story because it combines first-contact, continuous, comprehensive care with prevention, chronic-illness management, specialist coordination, and follow-up. Restricting the fictional clinic to adults avoids pediatric identity/consent and dosing, obstetric care, and other scope that the first product does not support.

This product positioning does not determine the physician's actual scope of practice, credentialing, standard of care, state licensure, telehealth obligations, or payer rules.

## Operating model

OneCare has one physician and no dedicated receptionist, scheduler, biller, referral coordinator, scribe, or prior-authorization specialist in the fictional target state. OnePractice automates routine administrative work under versioned rules and puts unresolved work into the physician's owned queue.

The clinic may offer virtual visits, limited in-person physician visits, annual wellness care, chronic-condition follow-up, medication reviews, preventive screening, and coordination of physician-approved labs, imaging, and referrals. External delivery is always separate from creating a Medplum resource:

```text
physician reviews/signs
  -> external partner receives
  -> partner acknowledges
  -> service is scheduled/performed
  -> result/report returns
  -> physician reviews
  -> patient communication/follow-up closes the loop
```

No dedicated administrative staff does not mean no exceptions. In the fictional one-human model, the physician owns every queue that requires human judgment or identity resolution. A production practice could delegate suitable queues to authorized staff.

## Explicit exclusions

OneCare does not present itself as a hospital and does not provide or automate:

- emergency or inpatient care;
- surgery, procedural sedation, critical care, obstetric delivery, chemotherapy, or infusion;
- conditions requiring immediate physical intervention;
- controlled-substance management in the demo;
- autonomous triage, diagnosis, treatment, prescribing, ordering, or result interpretation.

The public agent does not “detect red flags” or decide urgency. It accepts only the closed administrative intent grammar. Symptom-bearing, mixed, or unmatched text stops the routine workflow, displays neutral `Clinical content received — not assessed` copy, and creates one `requested` Task for the physician's configured review queue. Emergency language and after-hours copy must be published and reviewed by the clinic, a licensed clinician, and counsel; the model cannot improvise it.

## Hackathon patient: administrative slice

Maria is a fictional new patient requesting an adult annual wellness visit. The judged demo remains:

```text
public browser voice/type
  -> annual-wellness appointment
  -> Synthetic Demo Access
  -> intake missing synthetic member ID
  -> in-app follow-up
  -> Coverage + labeled eligibility projection
  -> original Task completed
  -> Ready visit in Dr. Chen's cockpit
  -> separate uncertain-identity replay creates one exception
```

The MVP does not expose Maria's clinical chart, symptoms, medication questions, transcription, orders, referrals, or claims. Using the same fictional persona preserves continuity without pretending those features are built.

## Roadmap patient: governed clinical slice

After the administrative workflow, authentication, patient-context locking, consent, clinical review UI, validated medication sources, and external integrations are ready, Maria may have a synthetic longitudinal record containing hypertension, type 2 diabetes, dyslipidemia, a documented penicillin reaction, prior medication history, and preventive-care gaps.

The seeded roadmap fixture may include a prior signed note stating that lisinopril was discontinued after a persistent cough, missing or stale renal/potassium and diabetes-monitoring results, and an overdue diabetic eye examination. These are fictional test facts, not conclusions inferred by the model.

A future scenario can demonstrate:

1. Explicitly start and consent to a synthetic encounter recording.
2. Deepgram produces a finalized source transcript; it does not create chart facts.
3. The physician asks why a prior medication was stopped.
4. OnePractice searches exact scoped Medplum records and re-fetches the cited current resource/version. Moss is not required for patient-note retrieval.
5. For a candidate medication question, RxNorm normalizes identity, Medplum supplies exact patient facts, validated medication sources run deterministic checks, and optional Moss retrieves only public versioned DailyMed passages.
6. The UI shows facts used, missing/stale data, checks performed/unavailable, and citations. It does not answer “safe” or recommend treatment.
7. The physician may prepare separate note, medication, lab, referral, follow-up, and instruction proposals.

Two useful roadmap prompts are:

- `Why was lisinopril stopped?` → retrieve the exact current Medplum note/version and display its signed source/date.
- `Show me the evidence I should review before considering losartan.` → normalize the candidate, display relevant patient facts and missing data, run only configured validated checks, retrieve cited public-label evidence, and return `review_only`. It must not say that losartan is reasonable, safe, indicated, or the preferred alternative.

Each consequential action has its own exact details, sources, validation, and accept/edit/reject state. There is no blanket `Sign and execute`, `Accept all`, or conversational signature. After individual review/signature, transmission, acknowledgment, results, and closure remain separately tracked states.

The prior-medication and candidate-alternative examples are synthetic workflow demonstrations, not medical recommendations or a predefined care plan for a real patient.

## Vendor roles in the clinic story

| Layer | Role | Boundary |
| --- | --- | --- |
| OnePractice | policy, workflow, exception routing, UI | never substitutes for clinician judgment |
| Medplum | clinical/workflow source of truth and exact patient retrieval | creating a resource is not external fulfillment |
| Deepgram | optional conversational speech and future transcription | deterministic typed fallback remains; outputs are untrusted |
| Stedi | eligibility and future payer transactions | no guarantee of coverage, network, authorization, price, or payment |
| Moss | optional future public medication-label retrieval | no patient facts/notes/PHI and no safety decision |

## Pitch

> OnePractice powers OneCare, an AI-native adult primary-care microclinic operated by one family physician. The platform completes routine access, intake, coverage, coordination, documentation, and payment workflows; the physician performs clinical judgment and signs consequential actions; external partners deliver physical and specialty services.

For the hackathon, finish the sentence with the proof rather than the roadmap:

> Today, one annual-wellness request becomes one Medplum-backed Ready visit, and every uncertainty becomes one owned exception.

## Primary source

- [AAFP: Family medicine](https://www.aafp.org/about/family-medicine)
- [AAFP: Definition of family medicine](https://www.aafp.org/about/policies/family-medicine-definition)
- [AAFP: Primary care](https://www.aafp.org/about/policies/primary-care)
