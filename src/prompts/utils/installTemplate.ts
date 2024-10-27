import { downloadTemplate } from "giget";
import path from "pathe";

import { handleError, verbose } from "~/prompts/utils/console";
import { getCurrentWorkingDirectory } from "~/prompts/utils/fs";
import { initializeGitRepository } from "~/prompts/utils/git";
import { isDev } from "~/settings";

export async function installTemplate(
  name: string,
  template: string,
  deps: boolean,
  gitOption: string,
): Promise<void> {
  try {
    const cwd = getCurrentWorkingDirectory();
    const targetDir = path.join(cwd, isDev ? ".." : "", name);

    verbose("info", `Installing template in: ${targetDir}`);

    const { dir, source } = await downloadTemplate(`github:${template}`, {
      dir: targetDir,
      install: deps,
    });

    verbose("success", `${source} was downloaded to ${dir}.`);

    gitOption && (await initializeGitRepository(targetDir, gitOption));
  } catch (error) {
    handleError(error);
  }
}
