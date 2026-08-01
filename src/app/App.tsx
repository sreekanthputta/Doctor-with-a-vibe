import { resolveShell, type Shell } from './routes';

const shellCopy: Record<Shell, { eyebrow: string; title: string; description: string }> = {
  public: {
    eyebrow: 'VibeDoc front desk',
    title: 'One request. One ready visit.',
    description: 'Schedule and complete a synthetic annual-wellness intake by typing. Voice is optional.',
  },
  demo: {
    eyebrow: 'Synthetic Demo Access',
    title: 'Choose a fictional workspace',
    description: 'This is a persona selector, not authentication. No real patient information is available.',
  },
  patient: {
    eyebrow: 'Synthetic patient workspace',
    title: 'Prepare for your visit',
    description: 'Review the appointment, intake, and coverage readiness for the fictional demo patient.',
  },
  physician: {
    eyebrow: 'Dr. Maya Chen',
    title: 'Physician cockpit',
    description: 'The next visit is suggested. Open it explicitly to inspect sources, provenance, and exceptions.',
  },
};

export function App(): React.JSX.Element {
  const shell = resolveShell(window.location.pathname);
  const copy = shellCopy[shell];

  return (
    <main className="shell" data-shell={shell}>
      <div className="demo-banner">Synthetic demo only · No real patient data</div>
      <section className="shell-card" aria-labelledby="page-title">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="page-title">{copy.title}</h1>
        <p>{copy.description}</p>
        <small>VibeDoc · Powered by Medplum</small>
      </section>
    </main>
  );
}
