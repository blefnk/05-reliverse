import { relinka } from "@reliverse/relinka";
import fs from "fs-extra";
import path from "pathe";
import pc from "picocolors";

export async function getProjectMenuOptions(
  cwd: string,
): Promise<{ label: string; value: string; hint?: string }[]> {
  const options = [
    {
      label: "👈 Exit",
      value: "exit",
      hint: pc.dim("ctrl+c anywhere"),
    },
  ];

  try {
    // Check if .reliverse exists and has content
    const rulesPath = path.join(cwd, ".reliverse");
    const rulesFileExists = await fs.pathExists(rulesPath);

    if (rulesFileExists) {
      relinka("info-verbose", "Using existing .reliverse file");
    }
  } catch (error) {
    // Only show warning for non-initialization errors
    if (error instanceof Error && !error.message.includes("JSON Parse error")) {
      relinka(
        "warn",
        "Error processing .reliverse file. Using basic menu options.",
      );
      relinka(
        "warn-verbose",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return options;
}
