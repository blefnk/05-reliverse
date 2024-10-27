import { consola } from "consola";
import path from "pathe";

import { askAppName } from "~/prompts/04-askAppName";
import { askGitInitialization } from "~/prompts/08-askGitInitialization";
import { askInstallDependencies } from "~/prompts/09-askInstallDependencies";
import { askSummaryConfirmation } from "~/prompts/10-askSummaryConfirmation";
import { choosePackageManager } from "~/prompts/utils/choosePackageManager";
import { getCurrentWorkingDirectory } from "~/prompts/utils/fs";
import { installTemplate } from "~/prompts/utils/installTemplate";
import { validate } from "~/prompts/utils/validate";
import { isDev } from "~/settings";

export async function installRepository() {
  consola.info("You can clone any JavaScript/TypeScript library or tool.");

  const libraryOption = await consola.prompt("Select an option to proceed:", {
    options: [
      "1. Clone Reliverse CLI repository",
      "2. Provide a custom GitHub URL",
    ] as const,
    type: "select",
  });

  let libraryRepo = "";

  if (libraryOption === "1. Clone Reliverse CLI repository") {
    libraryRepo = "reliverse/cli"; // Shorthand for the GitHub repo
  } else if (libraryOption === "2. Provide a custom GitHub URL") {
    const customRepo = await consola.prompt(
      "Enter the GitHub repository link:",
      {
        type: "text",
      },
    );

    validate(customRepo, "string", "Custom repository selection canceled.");
    libraryRepo = customRepo.replace("https://github.com/", "github:");
  }

  const projectName = await askAppName();
  const gitOption = await askGitInitialization();
  const installDeps = await askInstallDependencies("installRepository");

  // Call confirmation with all necessary params
  const confirmed = await askSummaryConfirmation(
    libraryRepo, // Template
    projectName, // Project Name
    "", // GitHub User (none in this case)
    "", // Website (none in this case)
    gitOption, // Git Option
    installDeps, // Install dependencies boolean
  );

  if (!confirmed) {
    consola.info("Library cloning process was canceled.");

    return;
  }

  const cwd = getCurrentWorkingDirectory();
  const targetDir = isDev
    ? path.join(cwd, "..", projectName)
    : path.join(cwd, projectName);

  await installTemplate(projectName, libraryRepo, installDeps, gitOption);

  if (installDeps) {
    const pkgManager = await choosePackageManager(cwd);

    consola.info(`Using ${pkgManager} to install dependencies...`);

    try {
      consola.success("Dependencies installed successfully.");
    } catch (error) {
      consola.error("Failed to install dependencies:", error);
    }
  } else {
    const pkgManager = await choosePackageManager(cwd);

    consola.info(
      `👉 To install manually, run: cd ${targetDir} && ${pkgManager} i`,
    );
  }

  consola.success(`Library/Tool from ${libraryRepo} cloned successfully.`);
  consola.info(`👉 If you have VSCode installed, run: code ${targetDir}\n`);
}
