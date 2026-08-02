import type { DossierFile } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { formatDateTime } from "@/shared/lib/format";
import { Card } from "@/shared/components/Card";
import { DataTable, type Column } from "@/shared/components/DataTable";

interface DossierFilesProps {
  files: DossierFile[];
  enriched: boolean;
}

/**
 * Attribution comes from the GitHub App, not the push payload. When the App is
 * not installed the table says so rather than showing an empty list that reads
 * like "this person touched nothing".
 */
export function DossierFiles({ files, enriched }: DossierFilesProps) {
  const t = useTranslate();

  const columns: Column<DossierFile>[] = [
    { key: "path", header: t("dossier.files"), render: (file) => <span className="ltr mono">{file.path}</span> },
    { key: "added", header: t("dossier.linesAdded"), render: (file) => file.linesAdded },
    { key: "removed", header: t("dossier.linesRemoved"), render: (file) => file.linesRemoved },
    {
      key: "lastTouched",
      header: t("dossier.lastTouched"),
      render: (file) => formatDateTime(file.lastTouchedAt, "—"),
    },
  ];

  return (
    <Card title={t("dossier.files")}>
      <DataTable
        columns={columns}
        rows={files}
        rowKey={(file) => file.path}
        emptyMessage={enriched ? t("dossier.empty") : t("dossier.notEnriched")}
      />
    </Card>
  );
}
