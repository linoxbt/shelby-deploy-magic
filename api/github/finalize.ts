// Legacy artifact endpoints cannot bypass the isolated build pipeline.
export default function handler(_req: any, res: any) {
  return res
    .status(410)
    .json({
      error:
        "Direct artifact publishing has been retired. Submit source to /api/deployments or trigger a connected repository build.",
    });
}
