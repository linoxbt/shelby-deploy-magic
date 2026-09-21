import { isDeepStrictEqual } from "node:util";
import { shelbyBlobUrl } from "./_lib/shelby";
import { boundedBody } from "./_lib/bounded-body";
import { z } from "zod";
import { requireAuth, requireAptosAddress } from "./_lib/auth";
import { deploymentColumns, buildConfigSchema } from "./_lib/build-contract";
import { enqueueBuild, frozenSource } from "./_lib/build-queue";
import { getOwnedProject, getSupabaseAdmin } from "./_lib/supabase";
import { normalizeSlug } from "./_lib/normalize";
import { errorResponse, methodNotAllowed, readJson } from "./_lib/http";

export default async function handler(req: any, res: any) {
  try {
    const auth = await requireAuth(req),
      db = getSupabaseAdmin();
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "GET") {
      const project = await getOwnedProject(auth.userId, String(req.query.slug || ""));
      const id = req.query.deploymentId ? z.string().uuid().parse(req.query.deploymentId) : null;
      let query = db
        .from("shelby_deployments")
        .select(deploymentColumns)
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (id) query = query.eq("id", id);
      const { data, error } = await query;
      if (error) throw error;
      let logs: any[] = [];
      if (id) {
        if (!data?.length) throw new Error("Deployment not found");
        const after = z.coerce
          .number()
          .int()
          .min(0)
          .parse(req.query.after || 0);
        const result = await db
          .from("shelby_build_logs")
          .select("sequence,stage,stream,line,created_at")
          .eq("project_id", project.id)
          .eq("deployment_id", id)
          .gt("sequence", after)
          .order("sequence")
          .limit(500);
        if (result.error) throw result.error;
        logs = result.data || [];
      }
      return res.status(200).json({
        deployments: data,
        activeDeploymentId: (project as any).active_deployment_id,
        buildConfig: (project as any).build_config || {},
        logs,
        cursor: logs.at(-1)?.sequence || Number(req.query.after || 0),
        hasMore: logs.length === 500,
      });
    }
    if (req.method === "POST") {
      const body = await readJson<any>(req);
      let project: any;
      const config = buildConfigSchema.parse(body.config || {});
      if (body.projectSlug)
        project = await getOwnedProject(
          auth.userId,
          z.string().min(1).max(63).parse(body.projectSlug),
        );
      let sourceInput = body.source;
      if (!sourceInput && project) {
        const { data, error } = await db
          .from("shelby_build_jobs")
          .select("source,config")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (!data)
          throw new Error("Configure a source repository or upload source before redeploying");
        sourceInput = data.source;
        if (sourceInput.kind === "github") delete sourceInput.commit;
      }
      const source = await frozenSource(auth.userId, sourceInput);
      if (!project) {
        const name = z.string().trim().min(1).max(100).parse(body.name),
          slug = normalizeSlug(body.slug || name);
        const { count, error: countError } = await db
          .from("shelby_projects")
          .select("id", { head: true, count: "exact" })
          .eq("owner_id", auth.userId);
        if (countError) throw countError;
        if ((count || 0) >= 100) throw new Error("Project limit reached");
        const walletAddress = requireAptosAddress(auth, String(body.walletAddress || ""));
        const result = await db
          .from("shelby_projects")
          .insert({
            owner_id: auth.userId,
            name,
            slug,
            status: "processing",
            source: source.kind === "github" ? "github" : "drag-drop",
            content_hash: "",
            latest_version_url: "",
            wallet_address: walletAddress,
            signer_mode: "connected",
            build_config: config,
            framework: "auto",
            build_output: config.outputDirectory || "auto",
          })
          .select("*")
          .single();
        if (result.error) throw result.error;
        project = result.data;
      }
      if (source.kind === "github") {
        const [account, repository] = source.repository.split("/");
        const { error } = await db.from("shelby_github_connections").upsert(
          {
            project_id: project.id,
            account,
            repository,
            branch: source.branch,
            automation_status: "native-worker",
            webhook_status: "active",
          },
          { onConflict: "project_id,repository,branch" },
        );
        if (error) throw error;
      }
      const id = await enqueueBuild(
        project,
        auth.userId,
        source,
        body.config ? config : project.build_config || {},
      );
      return res.status(202).json({
        project: { id: project.id, slug: project.slug, name: project.name },
        deploymentId: id,
        status: "queued",
      });
    }
    if (req.method === "PATCH") {
      const body = await readJson<any>(req),
        project = await getOwnedProject(auth.userId, String(body.projectSlug || ""));
      const id = z.string().uuid().parse(body.deploymentId);
      const prior = await db
        .from("shelby_deployments")
        .select("id,project_id,content_hash,shelby_owner_address,shelby_manifest")
        .eq("id", id)
        .eq("project_id", project.id)
        .eq("status", "ready")
        .eq("pipeline_version", 2)
        .single();
      if (prior.error || !prior.data) throw new Error("Ready deployment not found");
      const release = prior.data;
      const stored = await fetch(
        shelbyBlobUrl(
          release.shelby_owner_address,
          `releases/${project.id}/${id}/${release.content_hash}/.shelby-manifest.json`,
        ),
        {
          headers: { Authorization: `Bearer ${process.env.SHELBY_API_KEY || ""}` },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!stored.ok)
        throw new Error(
          `Rollback unavailable: Shelby manifest returned ${stored.status}. Check storage retention.`,
        );
      const manifest = JSON.parse((await boundedBody(stored, 16 * 1024 * 1024)).toString());
      if (
        manifest.deploymentId !== id ||
        manifest.projectId !== project.id ||
        manifest.hash !== release.content_hash ||
        !isDeepStrictEqual(manifest.files, release.shelby_manifest)
      )
        throw new Error("Rollback manifest failed integrity verification");
      const { error } = await db.rpc("shelby_rollback", {
        p_project: project.id,
        p_owner: auth.userId,
        p_deployment: id,
      });
      if (error) throw error;
      return res.status(200).json({ ok: true, activeDeploymentId: id });
    }
    return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
  } catch (error) {
    return errorResponse(
      res,
      error instanceof Error
        ? error
        : new Error((error as any)?.message || "Deployment request failed"),
    );
  }
}
