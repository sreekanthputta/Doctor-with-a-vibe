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
      <div className="vd-demo-banner" role="note">
        DEMO · SYNTHETIC DATA
      </div>
      <header className="vd-shell__header">
        <p className="vd-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="vd-endorsement">VibeDoc · Powered by Medplum</p>
      </header>
      {children}
    </main>
  );
}
