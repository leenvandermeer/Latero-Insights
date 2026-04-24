Latero MDCF — Power BI Setup
==============================

Prerequisites:
- Power BI Desktop (June 2024 or later)
- Databricks ODBC driver or Power BI Databricks connector
- Access to workspace: https://dbc-2f5a2381-e7df.cloud.databricks.com

To open:
1. Open Power BI Desktop
2. File > Open report > Browse > select Latero MDCF.pbip
3. When prompted for credentials: use your Databricks personal access token

To configure the warehouse HTTP path:
1. In Power BI Desktop: Transform Data > Data source settings
2. Update the HttpPath parameter to your SQL warehouse HTTP path
   Example: /sql/1.0/warehouses/abc123def456

Tables loaded:
- PipelineRuns      -> workspace.meta.pipeline_runs
- DataQualityChecks -> workspace.meta.data_quality_checks
- DataLineage       -> workspace.meta.data_lineage

Relationships:
- PipelineRuns[run_id] 1->* DataQualityChecks[run_id]
- PipelineRuns[run_id] 1->* DataLineage[run_id]

Pages:
1. Pipeline Health — run counts, success rate, duration, trend
2. Data Quality    — pass rate, category breakdown, check details
3. Lineage         — hop counts, entity map, attribute detail
