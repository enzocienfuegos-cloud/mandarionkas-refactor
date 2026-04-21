import {
  listDiscrepancyReports,
  getDiscrepancyReport,
  createDiscrepancyReport,
  updateDiscrepancyReport,
  deleteDiscrepancyReport,
  getDiscrepancySummary,
  getThresholds,
  upsertThresholds,
} from '@smx/db/discrepancies';

export function handleDiscrepancyRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/discrepancies — list reports (static before parameterized)
  app.get('/v1/discrepancies', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { tagId, severity, dateFrom, dateTo, limit, offset } = req.query;

    const reports = await listDiscrepancyReports(pool, workspaceId, {
      tagId,
      severity,
      dateFrom,
      dateTo,
      limit,
      offset,
    });

    return reply.send({ reports });
  });

  // GET /v1/discrepancies/summary — static route
  app.get('/v1/discrepancies/summary', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo } = req.query;

    const summary = await getDiscrepancySummary(pool, workspaceId, { dateFrom, dateTo });
    return reply.send({ summary });
  });

  // GET /v1/discrepancies/thresholds — static route
  app.get('/v1/discrepancies/thresholds', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;

    const thresholds = await getThresholds(pool, workspaceId);
    return reply.send({ thresholds });
  });

  // PUT /v1/discrepancies/thresholds — static route, update thresholds
  app.put('/v1/discrepancies/thresholds', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { warningPct, criticalPct } = req.body ?? {};

    if (warningPct === undefined || criticalPct === undefined) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'warningPct and criticalPct are required',
      });
    }

    const warning = Number(warningPct);
    const critical = Number(criticalPct);

    if (isNaN(warning) || isNaN(critical) || warning < 0 || critical < 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'warningPct and criticalPct must be non-negative numbers',
      });
    }

    if (warning > critical) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'warningPct must be less than or equal to criticalPct',
      });
    }

    const thresholds = await upsertThresholds(pool, workspaceId, {
      warning_pct: warning,
      critical_pct: critical,
    });

    return reply.send({ thresholds });
  });

  // POST /v1/discrepancies — create report
  app.post('/v1/discrepancies', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { tagId, date, source, servedImps, reportedImps, notes } = req.body ?? {};

    if (!tagId || !date || !source || servedImps === undefined || reportedImps === undefined) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'tagId, date, source, servedImps, and reportedImps are required',
      });
    }

    const report = await createDiscrepancyReport(pool, workspaceId, {
      tag_id: tagId,
      date,
      source,
      served_imps: servedImps,
      reported_imps: reportedImps,
      notes,
    });

    return reply.status(201).send({ report });
  });

  // GET /v1/discrepancies/:id — single report (AFTER static routes)
  app.get('/v1/discrepancies/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const report = await getDiscrepancyReport(pool, workspaceId, id);
    if (!report) {
      return reply.status(404).send({ error: 'Not Found', message: 'Discrepancy report not found' });
    }

    return reply.send({ report });
  });

  // PUT /v1/discrepancies/:id — update report
  app.put('/v1/discrepancies/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const { notes, severity } = req.body ?? {};

    const data = {};
    if (notes !== undefined) data.notes = notes;
    if (severity !== undefined) data.severity = severity;

    const report = await updateDiscrepancyReport(pool, workspaceId, id, data);
    if (!report) {
      return reply.status(404).send({ error: 'Not Found', message: 'Discrepancy report not found' });
    }

    return reply.send({ report });
  });

  // DELETE /v1/discrepancies/:id — delete report
  app.delete('/v1/discrepancies/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const deleted = await deleteDiscrepancyReport(pool, workspaceId, id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Not Found', message: 'Discrepancy report not found' });
    }

    return reply.status(204).send();
  });
}
