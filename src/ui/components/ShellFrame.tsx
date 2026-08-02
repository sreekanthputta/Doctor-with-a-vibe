import type { ReactNode } from 'react';
import '../ui.css';

type ShellFrameProps = Readonly<{
  children: ReactNode;
  eyebrow: string;
  title: string;
  shell: 'public' | 'demo' | 'patient' | 'physician';
}>;

export function ShellFrame({ children, eyebrow, title, shell }: ShellFrameProps): React.JSX.Element {
  return (
    <main className={`vd-shell vd-shell--${shell}`} data-shell={shell}>
      <div className="vd-shell__chrome">
        <div className="vd-brand" aria-label="VibeDoc">
          <span className="vd-brand__mark" aria-hidden="true">V</span>
          <span className="vd-brand__name">VibeDoc</span>
        </div>
        <div className="vd-demo-banner" role="note">
          <span className="vd-status-dot" aria-hidden="true" />
          DEMO · SYNTHETIC DATA
        </div>
        <span className="vd-powered">Powered by Medplum</span>
      </div>
      <header className="vd-shell__header">
        <p className="vd-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="vd-endorsement">Administrative automation with clinical accountability.</p>
      </header>
      {children}
    </main>
  );
}
