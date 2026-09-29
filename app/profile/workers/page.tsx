import { WorkersAdmin } from "@/components/workers-admin";
import { canManageAdmins } from "@/lib/capabilities";
import { JOB_STATUS, JOB_SUBJECT, WORKER_STATUS } from "@/lib/jobs/types";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-user";

async function titlesForJobs(
  jobs: Array<{ subjectType: string; subjectId: bigint }>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const stickers = jobs
    .filter((j) => j.subjectType === JOB_SUBJECT.sticker)
    .map((j) => j.subjectId);
  const sheets = jobs
    .filter((j) => j.subjectType === JOB_SUBJECT.stickerSheet)
    .map((j) => j.subjectId);
  const packs = jobs
    .filter((j) => j.subjectType === JOB_SUBJECT.stickerPack)
    .map((j) => j.subjectId);

  const [stickerRows, sheetRows, packRows] = await Promise.all([
    stickers.length
      ? prisma.sticker.findMany({
          where: { id: { in: stickers } },
          select: { id: true, title: true },
        })
      : [],
    sheets.length
      ? prisma.stickerSheet.findMany({
          where: { id: { in: sheets } },
          select: { id: true, name: true },
        })
      : [],
    packs.length
      ? prisma.stickerPack.findMany({
          where: { id: { in: packs } },
          select: { id: true, name: true },
        })
      : [],
  ]);

  for (const s of stickerRows) {
    out.set(`${JOB_SUBJECT.sticker}:${s.id}`, s.title);
  }
  for (const s of sheetRows) {
    out.set(`${JOB_SUBJECT.stickerSheet}:${s.id}`, s.name);
  }
  for (const p of packRows) {
    out.set(`${JOB_SUBJECT.stickerPack}:${p.id}`, p.name);
  }
  for (const j of jobs) {
    if (j.subjectType === JOB_SUBJECT.catalog) {
      out.set(`${JOB_SUBJECT.catalog}:${j.subjectId}`, "Catalog reindex");
    }
  }
  return out;
}

export default async function ProfileWorkersPage() {
  const { user } = await requireAdmin();
  const isSuperadmin = canManageAdmins({
    role: user.role,
    accountStatus: user.accountStatus,
  });

  const [workers, keys] = await Promise.all([
    prisma.worker.findMany({
      // Hide offline workers whose key was revoked; keep offline if key still valid.
      where: {
        OR: [
          { apiKey: { revokedAt: null } },
          { status: WORKER_STATUS.online },
        ],
      },
      orderBy: [{ status: "asc" }, { lastHeartbeatAt: "desc" }],
      include: { apiKey: { select: { name: true, prefix: true } } },
      take: 100,
    }),
    isSuperadmin
      ? prisma.workerApiKey.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  const activeJobs =
    workers.length === 0
      ? []
      : await prisma.job.findMany({
          where: {
            workerId: { in: workers.map((w) => w.id) },
            status: { in: [JOB_STATUS.leased, JOB_STATUS.running] },
          },
          orderBy: { updatedAt: "desc" },
          take: 200,
        });

  const titles = await titlesForJobs(activeJobs);
  const jobsByWorker = new Map<
    string,
    Array<{
      jobId: string;
      type: string;
      subjectType: string;
      subjectId: string;
      title: string;
    }>
  >();
  for (const j of activeJobs) {
    if (j.workerId == null) continue;
    const key = j.workerId.toString();
    const list = jobsByWorker.get(key) ?? [];
    list.push({
      jobId: j.id.toString(),
      type: j.type,
      subjectType: j.subjectType,
      subjectId: j.subjectId.toString(),
      title:
        titles.get(`${j.subjectType}:${j.subjectId}`) ??
        `${j.subjectType} #${j.subjectId}`,
    });
    jobsByWorker.set(key, list);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Workers</h1>
      <p className="mt-1 text-sm text-secondary">
        Remote encode fleet status
        {isSuperadmin ? " and API keys" : ""}.
      </p>
      <div className="mt-8">
        <WorkersAdmin
          isSuperadmin={isSuperadmin}
          workers={workers.map((w) => {
            let capabilities: string[] = [];
            try {
              capabilities = JSON.parse(w.capabilities) as string[];
            } catch {
              capabilities = [];
            }
            return {
              id: w.id.toString(),
              instanceId: w.instanceId,
              version: w.version,
              capabilities,
              concurrency: w.concurrency,
              cpuPct: w.cpuPct,
              memMb: w.memMb,
              status: w.status,
              lastHeartbeatAt: w.lastHeartbeatAt?.toISOString() ?? null,
              keyName: w.apiKey.name,
              keyPrefix: w.apiKey.prefix,
              activeJobs: jobsByWorker.get(w.id.toString()) ?? [],
            };
          })}
          keys={keys.map((k) => ({
            id: k.id.toString(),
            name: k.name,
            prefix: k.prefix,
            revokedAt: k.revokedAt?.toISOString() ?? null,
            createdAt: k.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
