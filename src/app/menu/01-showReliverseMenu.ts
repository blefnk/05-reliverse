import { selectPrompt } from "@reliverse/prompts";
import { relinka } from "@reliverse/relinka";
import { emojify } from "node-emoji";
import pc from "picocolors";

import { buildBrandNewThing } from "./02-buildBrandNewThing.js";

// import { installAnyGitRepo } from "./03-installAnyGitRepo.js";
// import { askProjectDetails } from "./04-askProjectDetails.js";
// import { pkg } from "~/utils/pkg.js";

// import { installAnyGitRepo } from "./03-installAnyGitRepo";
// import { shadcnComponents } from "~/utils/shadcnComponents";

// export async function showReliverseMenu(program: Command) {
export async function showReliverseMenu() {
  // let template = "";

  // TODO: if config contains at least one project, show "Open project" option
  // TODO: implement "Edit Reliverse Memory" option (configuration data editor)

  const option = await selectPrompt({
    title:
      "🤖 What would you like to create today? I'm your all-in-one tool for developing anything!",
    titleColor: "retroGradient",
    options: [
      {
        label: "Build a brand new thing from scratch",
        value: "1",
      },
      // {
      //   label: emojify(
      //     ":toolbox:  [Maintenance] Clone and configure any GitHub repo",
      //   ),
      //   value: "2",
      //   disabled: true,
      // },
      // "4. Add shadcn/ui components to your React/Vue/Svelte project",
      // "5. Run code modifications on the existing codebase",
      // "6. Update your GitHub clone with the latest changes",
      // "7. Add, remove, or replace the Relivator's features",
      { label: pc.italic("Exit"), value: "exit" },
    ],
    // debug: false,
    // terminalHeight: 14,
    // availableHeight: 10,
    // computedMaxItems: 3,
    // displayItems: 3,
    // startIdx: 0,
    // endIdx: 2,
    // shouldRenderTopEllipsis: false,
    // shouldRenderBottomEllipsis: false,
    // linesRendered: 5,
  });

  if (option === "1") {
    await buildBrandNewThing();
  }
  // else if (option === "2") {
  //   // await installAnyGitRepo();
  //   relinka.error("This option is not available yet.");
  // }
  // else if ( option === "4. Add shadcn/ui components to your React/Vue/Svelte project" ) {
  //   await shadcnComponents(program);
  // }
  // else if (option === "5. Run code modifications on the existing codebase") {
  //   await askCodemodUserCodebase();
  // } else if (option === "6. Update your GitHub clone with the latest changes") {
  //   await showUpdateCloneMenu();
  // } else if (option === "7. Add, remove, or replace the Relivator's features") {
  //   await showRelivatorFeatEditor();
  // }
  else if (option === "exit") {
    process.exit(0);
  } else {
    relinka.error("Invalid option selected. Exiting.");
  }

  // return template;
}
