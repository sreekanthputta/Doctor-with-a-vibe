import type { PhysicianVisitVM, WorkflowEvidenceResourceVM } from '../view-models';

type EvidenceInspectorProps = Readonly<{
  visit: PhysicianVisitVM;
}>;

function EvidenceResource({ evidence }: Readonly<{ evidence: WorkflowEvidenceResourceVM }>): React.JSX.Element {
  return (
    <li className="vd-evidence-resource">
      <div className="vd-evidence-resource__heading">
        <code>{evidence.reference}</code>
        <span>Version {evidence.versionId}</span>
      </div>
      <p><strong>{evidence.workflowRoleLabel}</strong></p>
      <dl>
        {evidence.businessIdentifier === undefined ? null : (
          <div>
            <dt>Business identifier</dt>
            <dd><code>{evidence.businessIdentifier}</code></dd>
          </div>
        )}
        <div>
          <dt>Source timestamp</dt>
          <dd><time dateTime={evidence.sourceTimestamp}>{evidence.sourceTimestamp}</time></dd>
        </div>
        <div>
          <dt>Linkage</dt>
          <dd>{evidence.linkageSummary}</dd>
        </div>
      </dl>
    </li>
  );
}

export function EvidenceInspector({ visit }: EvidenceInspectorProps): React.JSX.Element {
  const task = visit.resolvedTaskHistory;
  const eligibility = visit.eligibilityLinkage;
  const securityEvent = visit.securityEvent;

  return (
    <>
      <section aria-labelledby="workflow-evidence-title">
        <h2 id="workflow-evidence-title">Medplum workflow evidence</h2>
        {visit.sourceModes ? (
          <dl role="group" aria-label="Workflow source modes">
            <div>
              <dt>Conversation</dt>
              <dd>{visit.sourceModes.conversation.label}</dd>
            </div>
            <div>
              <dt>Persistence</dt>
              <dd>{visit.sourceModes.persistence.label}</dd>
            </div>
          </dl>
        ) : <p>{visit.sourceLabel}</p>}
        <p>Updated: <time dateTime={visit.sourceUpdatedAt}>{visit.sourceUpdatedAt}</time></p>
        <p>FHIR Provenance: {visit.provenanceState}</p>
        <ul className="vd-evidence-list vd-list-reset">
          {visit.evidenceResources.map((evidence) => (
            <EvidenceResource key={evidence.reference} evidence={evidence} />
          ))}
        </ul>
      </section>

      {task ? <section className="vd-evidence-card" aria-labelledby="resolved-task-title">
        <h3 id="resolved-task-title">Resolved Task history</h3>
        <p><strong>Completed</strong> · <code>{task.reference}</code> · Version {task.versionId}</p>
        <dl>
          {task.businessIdentifier === undefined ? null : (
            <div><dt>Business identifier</dt><dd><code>{task.businessIdentifier}</code></dd></div>
          )}
          <div><dt>Owner</dt><dd>{task.ownerDisplay}</dd></div>
          <div><dt>Source timestamp</dt><dd><time dateTime={task.sourceTimestamp}>{task.sourceTimestamp}</time></dd></div>
          <div><dt>Resolution</dt><dd>{task.resolutionSummary}</dd></div>
          <div><dt>Sequence</dt><dd>{task.linkageSummary}</dd></div>
        </dl>
      </section> : (
        <section className="vd-evidence-card" aria-label="Open Task history">
          <h3>Task remains open</h3>
          <p>Required-field resolution has not been completed.</p>
        </section>
      )}

      {eligibility ? <section className="vd-evidence-card" aria-labelledby="eligibility-linkage-title">
        <h3 id="eligibility-linkage-title">Eligibility evidence linkage</h3>
        <p><strong>{eligibility.summary}</strong></p>
        <ol className="vd-evidence-linkage">
          <li><code>{eligibility.requestReference}</code></li>
          <li><code>{eligibility.responseReference}</code></li>
          <li><code>{eligibility.coverageReference}</code></li>
        </ol>
        <p>
          {eligibility.transactionState === 'completed' ? 'Completed' : eligibility.transactionState}
          {' · '}
          {eligibility.providerMode}
        </p>
        <time dateTime={eligibility.sourceTimestamp}>{eligibility.sourceTimestamp}</time>
      </section> : (
        <section className="vd-evidence-card" aria-label="Eligibility not run">
          <h3>Eligibility evidence linkage</h3>
          <p>Not run · waiting for the required member ID.</p>
        </section>
      )}

      <section className="vd-evidence-card vd-security-event" aria-labelledby="security-event-title">
        <h3 id="security-event-title">Sanitized application security event</h3>
        <p>
          <strong>{securityEvent.decision === 'allowed' ? 'Allowed' : 'Denied'}</strong>
          {' · '}
          <span>{securityEvent.sourceLabel}</span>
        </p>
        <dl>
          <div><dt>Event</dt><dd><code>{securityEvent.eventId}</code></dd></div>
          <div><dt>Actor role</dt><dd><code>{securityEvent.actorRole}</code></dd></div>
          <div><dt>Action class</dt><dd>{securityEvent.actionClass}</dd></div>
          <div><dt>Correlation</dt><dd><code>{securityEvent.correlationId}</code></dd></div>
          <div><dt>Timestamp</dt><dd><time dateTime={securityEvent.occurredAt}>{securityEvent.occurredAt}</time></dd></div>
        </dl>
        <p>Not FHIR Provenance or a Medplum access audit.</p>
      </section>
    </>
  );
}
