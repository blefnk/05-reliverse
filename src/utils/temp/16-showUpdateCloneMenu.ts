import { selectPrompt, inputPrompt } from "@reliverse/prompts";
import { relinka } from "@reliverse/relinka";
import { execa } from "execa";
import fs from "fs-extra";
import { ofetch } from "ofetch";
import path from "pathe";

import { REPO_SHORT_URLS } from "~/app/data/constants.js";
import { verbose } from "~/utils/console.js";
import { downloadGitRepo } from "~/utils/downloadGitRepo.js";
import { getCurrentWorkingDirectory } from "~/utils/fs.js";
import { validate } from "~/utils/validate.js";

const cwd = getCurrentWorkingDirectory();

export async function showUpdateCloneMenu(isDev: boolean) {
  relinka.info(
    "🔥 The current mode is in active development and may not be stable. ✨ Select the supported repository you have cloned from GitHub to update it with the latest changes.",
  );

  const options = [
    REPO_SHORT_URLS.relivatorGithubLink,
    ...(isDev ? ["🚧 relivator (local dev only)"] : []),
  ];

  const option = await selectPrompt({
    title: "Select the repository to update",
    options: options.map((repo) => ({ label: repo, value: repo })),
  });

  validate(option, "string", "Invalid option selected. Exiting.");

  // for test development purposes only
  if (option === "🚧 relivator (local dev only)") {
    relinka.warn(
      "Make sure to run this script from the root folder of your reliverse/cli clone.",
    );
    const projectPath = await downloadGitRepo(
      "test-name",
      "blefnk/versator",
      isDev,
    );
    if (projectPath) {
      await runScript(path.join(projectPath, "src/prompts/tests/updater.ts"));
    }
  } else {
    await downloadRunUpdaterTSScript(option);
  }

  relinka.success("The repository has been updated successfully.");
}

async function downloadRunUpdaterTSScript(repoShortUrl: string) {
  const updaterScriptUrl = `https://raw.githubusercontent.com/${repoShortUrl}/main/scripts/update.ts`;
  const updaterScriptPath = path.join(cwd, "updater.ts");

  await downloadFileFromUrl(updaterScriptUrl, updaterScriptPath);
  await runScript(updaterScriptPath);
}

async function downloadFileFromUrl(url: string, path: string) {
  const response = await ofetch(url);
  const fileBuffer = await response.arrayBuffer();
  await fs.writeFile(path, Buffer.from(fileBuffer));
  relinka.info(`Downloaded the updater script to ${path}`);
}

async function runScript(path: string) {
  verbose("info", `Running the updater script at ${path}`);
  await execa(`tsx ${path}`);
}
