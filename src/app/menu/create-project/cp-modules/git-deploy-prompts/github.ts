import { RequestError } from "@octokit/request-error";
import { inputPrompt, selectPrompt } from "@reliverse/prompts";
import { relinka } from "@reliverse/prompts";
import fs from "fs-extra";
import path from "pathe";

import type { ReliverseConfig } from "~/utils/libs/config/schemaConfig.js";

import { cliName } from "~/app/constants.js";
import { type InstanceGithub } from "~/utils/instanceGithub.js";
import { cd } from "~/utils/terminalHelpers.js";

import { initGitDir } from "./git.js";
import { setupGitRemote } from "./utils-git-github.js";

export async function checkGithubRepoOwnership(
  githubInstance: InstanceGithub,
  owner: string,
  repo: string,
): Promise<{ exists: boolean; isOwner: boolean; defaultBranch?: string }> {
  try {
    const { data: repository } = await githubInstance.rest.repos.get({
      owner,
      repo,
    });
    return {
      exists: true,
      isOwner: repository.permissions?.admin ?? false,
      defaultBranch: repository.default_branch,
    };
  } catch (error) {
    if (error instanceof RequestError) {
      if (error.status === 404) {
        return { exists: false, isOwner: false };
      }
      if (error.status === 403) {
        throw new Error("GitHub API rate limit exceeded");
      }
      if (error.status === 401) {
        throw new Error("Invalid GitHub token");
      }
    }
    throw error;
  }
}

/**
 * Creates a new commit using GitHub's API
 */
export async function createGithubCommit({
  githubInstance,
  owner,
  repo,
  message,
  files,
  branch = "main",
}: {
  githubInstance: InstanceGithub;
  owner: string;
  repo: string;
  message: string;
  files: { path: string; content: string }[];
  branch?: string;
}): Promise<boolean> {
  try {
    // Get the current branch ref
    const { data: ref } = await githubInstance.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });

    // Get the current commit SHA
    const { data: commit } = await githubInstance.rest.git.getCommit({
      owner,
      repo,
      commit_sha: ref.object.sha,
    });

    // Create a tree with all the changes
    const { data: tree } = await githubInstance.rest.git.createTree({
      owner,
      repo,
      base_tree: commit.tree.sha,
      tree: files.map((file) => ({
        path: file.path,
        mode: "100644",
        type: "blob",
        content: file.content,
      })),
    });

    // Create a new commit
    const { data: newCommit } = await githubInstance.rest.git.createCommit({
      owner,
      repo,
      message,
      tree: tree.sha,
      parents: [commit.sha],
    });

    // Update the reference
    await githubInstance.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return true;
  } catch (error) {
    if (error instanceof RequestError) {
      if (error.status === 404) {
        relinka(
          "error",
          `Repository or branch not found: ${owner}/${repo}:${branch}`,
        );
      } else if (error.status === 403) {
        relinka("error", "Permission denied. Check your token's permissions.");
      } else {
        relinka("error", `Failed to create commit: ${error.message}`);
      }
    } else {
      relinka(
        "error",
        "Unexpected error creating commit:",
        error instanceof Error ? error.message : String(error),
      );
    }
    return false;
  }
}

/**
 * Creates a new commit with all local changes
 */
export async function commitLocalChanges({
  githubInstance,
  owner,
  repo,
  directory,
  changedFiles,
  message = `Update by ${cliName}`,
  branch = "main",
}: {
  githubInstance: InstanceGithub;
  owner: string;
  repo: string;
  directory: string;
  changedFiles: string[];
  message?: string;
  branch?: string;
}): Promise<boolean> {
  try {
    // Read all changed files
    const files = await Promise.all(
      changedFiles.map(async (filePath) => {
        const fullPath = path.join(directory, filePath);
        try {
          // Check if file exists and is readable
          if (await fs.pathExists(fullPath)) {
            const content = await fs.readFile(fullPath, "utf8");
            return { path: filePath, content };
          } else {
            relinka("warn", `File not found: ${filePath}, skipping...`);
            return null;
          }
        } catch (_error) {
          relinka("warn", `Could not read file ${filePath}, skipping...`);
          return null;
        }
      }),
    );

    // Filter out null entries (files that couldn't be read)
    const validFiles = files.filter(
      (file): file is { path: string; content: string } => file !== null,
    );

    if (validFiles.length === 0) {
      relinka("warn", "No valid files to commit");
      return false;
    }

    return await createGithubCommit({
      githubInstance,
      owner,
      repo,
      message,
      files: validFiles,
      branch,
    });
  } catch (error) {
    relinka(
      "error",
      "Failed to read local files:",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

export async function getAvailableGithubRepoName(
  githubInstance: InstanceGithub,
  owner: string,
  initialName: string,
): Promise<{
  name: string;
  exists: boolean;
  defaultBranch: string | undefined;
}> {
  let repoName = initialName;
  let repoStatus = await checkGithubRepoOwnership(
    githubInstance,
    owner,
    repoName,
  );

  while (repoStatus.exists) {
    if (repoStatus.isOwner) {
      const action = await selectPrompt({
        title: `Repository "${owner}/${repoName}" already exists`,
        options: [
          {
            label: "Use existing repository",
            value: "use",
            hint: "Continue working with your existing repository",
          },
          {
            label: "Create with different name",
            value: "new",
            hint: "Enter a new name for the repository",
          },
          {
            label: "Close the application",
            value: "close",
            hint: "Exit without completing the setup",
          },
        ],
      });

      switch (action) {
        case "use":
          return {
            name: repoName,
            exists: true,
            defaultBranch: repoStatus.defaultBranch,
          };
        case "close":
          relinka("info", "Setup cancelled by user.");
          process.exit(0);
      }
    }

    repoName = await inputPrompt({
      title: `Repository "${repoName}" ${
        repoStatus.isOwner ? "exists (owned by you)" : "already exists"
      }. Please enter a different name:`,
      defaultValue: repoName,
      validate: async (value: string): Promise<string | boolean> => {
        if (!value?.trim()) {
          return "Repository name is required";
        }
        if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
          return "Repository name can only contain letters, numbers, dots, hyphens, and underscores";
        }
        const status = await checkGithubRepoOwnership(
          githubInstance,
          owner,
          value,
        );
        if (status.exists && !status.isOwner) {
          return `Repository "${value}" already exists. Please choose a different name`;
        }
        return true;
      },
    });
    repoStatus = await checkGithubRepoOwnership(
      githubInstance,
      owner,
      repoName,
    );
  }

  return { name: repoName, exists: false, defaultBranch: undefined };
}

export async function createGithubRepo(
  githubInstance: InstanceGithub,
  repoName: string,
  repoOwner: string,
  projectPath: string,
  isDev: boolean,
  cwd: string,
  config: ReliverseConfig,
  isTemplateDownload: boolean,
): Promise<boolean> {
  if (isTemplateDownload) {
    relinka(
      "info-verbose",
      "Skipping createGithubRepo since it's a template download",
    );
    return true;
  }

  try {
    // 1. Ensure we have a GitHub token

    await cd(projectPath);

    // Initialize git and create repository
    relinka("info-verbose", "[C] initGitDir");
    await initGitDir({
      cwd,
      isDev,
      projectPath,
      projectName: repoName,
      allowReInit: true,
      createCommit: true,
      config,
      isTemplateDownload,
    });

    // For new repositories, determine privacy setting
    let privacyAction = config.repoPrivacy;
    if (privacyAction === "unknown") {
      const selectedPrivacyAction = await selectPrompt({
        title: "Choose repository privacy setting",
        defaultValue: "public",
        options: [
          {
            label: "Public repository",
            value: "public",
            hint: "Anyone can see the repository (recommended for open source)",
          },
          {
            label: "Private repository",
            value: "private",
            hint: "Only you and collaborators can see the repository",
          },
        ],
      });
      privacyAction = selectedPrivacyAction;
    }

    // Create the repository
    relinka("info-verbose", "Creating repository...");

    try {
      await githubInstance.rest.repos.createForAuthenticatedUser({
        name: repoName,
        private: privacyAction === "private",
        auto_init: false,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        relinka("error", `Repository '${repoName}' already exists on GitHub`);
        return false;
      }
      throw error;
    }

    // Setup remote and push initial commit
    const remoteUrl = `https://github.com/${repoOwner}/${repoName}.git`;
    relinka(
      "info-verbose",
      "Setting up Git remote and pushing initial commit...",
    );
    return await setupGitRemote(
      cwd,
      isDev,
      repoName,
      projectPath,
      remoteUrl,
      "origin",
    );
  } catch (error: any) {
    if (error instanceof RequestError) {
      if (error.status === 401 || error.status === 403) {
        relinka(
          "error",
          "GitHub token is invalid or lacks necessary permissions. Ensure your token has the 'repo' scope.",
        );
      } else if (error.status === 422) {
        relinka(
          "error",
          "Invalid repository name or repository already exists and you don't have access to it.",
        );
      } else if (error.message?.includes("rate limit")) {
        relinka(
          "error",
          "GitHub API rate limit exceeded. Please try again later.",
        );
      } else if (error.message?.includes("network")) {
        relinka(
          "error",
          "Network error occurred. Please check your internet connection.",
        );
      } else {
        relinka("error", "GitHub operation failed:", error.message);
      }
    } else {
      // Non-Octokit errors or unexpected exceptions
      relinka(
        "error",
        "An unexpected error occurred:",
        (error as Error)?.message ?? String(error),
      );
    }
    return false;
  }
}
