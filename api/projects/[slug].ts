import { requireAuth } from "../_lib/auth";
import { errorResponse, methodNotAllowed, readJson } from "../_lib/http";
import { getOwnedProject, getSupabaseAdmin } from "../_lib/supabase";

type UpdatePayload = {
  framework?: string;
  buildOutput?: string;
};

export default async function handler(req: any, res: any) {
  try {
    const auth = await requireAuth(req);
    const slug = req.query.slug as string;
    const supabase = getSupabaseAdmin();
    const project = await getOwnedProject(auth.userId, slug);

    if (req.method === "PATCH") {
      const body = await readJson<UpdatePayload>(req);
      const { error } = await supabase
        .from("shelby_projects")
        .update({
          framework: body.framework || project.framework,
          build_output: body.buildOutput || project.build_output,
        })
        .eq("id", project.id)
        .eq("owner_id", auth.userId);

      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { error } = await supabase
        .from("shelby_projects")
        .delete()
        .eq("id", project.id)
        .eq("owner_id", auth.userId);

      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return methodNotAllowed(res, ["PATCH", "DELETE"]);
  } catch (error) {
    return errorResponse(res, error);
  }
}
