import { appBaseDomain } from "./env";
export const GITHUB_DEPLOY_SECRET_NAME = "SHELBYHOST_DEPLOY_TOKEN";
export const GITHUB_WORKFLOW_FILE = ".github/workflows/shelbyhost-deploy.yml";
const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
export function githubWorkflowYaml({
  slug,
  branch,
}: {
  slug: string;
  branch: string;
  buildCommand?: string;
  buildOutput?: string;
}) {
  return `name: ShelbyHost source deployment
on:
  push:
    branches: [${quote(branch)}]
  workflow_dispatch:
permissions: {}
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Queue an isolated ShelbyHost build
        env:
          SHELBY_TOKEN: \${{ secrets.SHELBYHOST_DEPLOY_TOKEN }}
          SHELBY_URL: ${quote(process.env.SHELBY_APP_URL || `https://${appBaseDomain()}`)}
          PROJECT_SLUG: ${quote(slug)}
        run: |
          node <<'NODE'
          (async () => {
            const response = await fetch(process.env.SHELBY_URL + '/api/github/trigger', {
              method: 'POST',
              headers: { authorization: 'Bearer ' + process.env.SHELBY_TOKEN, 'content-type': 'application/json' },
              body: JSON.stringify({ slug: process.env.PROJECT_SLUG })
            });
            if (!response.ok) throw new Error(await response.text());
            const result = await response.json();
            console.log('Build queued: ' + result.deploymentId + '. Follow real build progress in ShelbyHost.');
          })().catch(error => { console.error(error.message); process.exitCode = 1; });
          NODE
`;
}
