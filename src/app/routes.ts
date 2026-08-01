export type Shell = 'public' | 'demo' | 'patient' | 'physician';

export function resolveShell(pathname: string): Shell {
  if (pathname === '/demo' || pathname.startsWith('/demo/')) return 'demo';
  if (pathname === '/patient' || pathname.startsWith('/patient/')) return 'patient';
  if (pathname === '/physician' || pathname.startsWith('/physician/')) return 'physician';
  return 'public';
}
