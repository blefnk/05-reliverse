import { endPrompt, startPrompt } from "@reliverse/prompts";
import { getTerminalWidth } from "@reliverse/relinka";

import { cliName, cliVersion } from "~/app/constants.js";

export async function showStartPrompt(isDev: boolean) {
  await startPrompt({
    titleColor: "inverse",
    clearConsole: true,
    packageName: cliName,
    packageVersion: cliVersion,
    isDev,
  });
}

export async function showEndPrompt() {
  const width = getTerminalWidth();
  await endPrompt({
    title:
      width < 100
        ? "│  Please support the CLI: https://patreon.com/c/blefnk/membership"
        : "│  ❤️  Please consider supporting @reliverse/cli development: https://patreon.com/c/blefnk/membership",
    titleAnimation: "glitch",
    titleColor: "dim",
    titleTypography: "bold",
    titleAnimationDelay: 800,
  });
}
