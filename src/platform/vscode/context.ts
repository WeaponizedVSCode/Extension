import { ExtensionContext } from "vscode";
import { UserCredential, Host } from "../../core";
import type { Foam } from "../../core";
import * as vscode from "vscode";
import { logger } from "../../platform/vscode/logger";

export class Context {
  private static _extContext: ExtensionContext;
  private static _foam: Foam;

  public static get context(): ExtensionContext {
    return this._extContext;
  }

  public static set context(ec: ExtensionContext) {
    this._extContext = ec;
  }

  public static get UserState(): UserCredential[] | undefined {
    let users = this.context.workspaceState.get<UserCredential[]>("users");
    if (users) {
      let returns: UserCredential[] = [];
      for (let u of users) {
        let user = new UserCredential().init(u);
        returns.push(user);
      }
      return returns;
    } else {
      return undefined;
    }
  }

  public static set UserState(us: UserCredential[]) {
    this.context.workspaceState.update("users", us);
  }

  public static get HostState(): Host[] | undefined {
    let hosts = this.context.workspaceState.get<Host[]>("hosts");
    if (hosts) {
      let returns: Host[] = [];
      for (let h of hosts) {
        let host = new Host().init(h);
        returns.push(host);
      }
      return returns;
    } else {
      return undefined;
    }
  }

  public static set HostState(hs: Host[]) {
    this.context.workspaceState.update("hosts", hs);
  }

  public async Foam(): Promise<Foam | undefined> {
    if (!Context._foam) {
      const foamExtension = vscode.extensions.getExtension("foam.foam-vscode");
      if (!foamExtension) {
        logger.warn("Foam extension is not installed.");
        vscode.window.showErrorMessage(
          "Foam extension is not installed. please install foam.foam-vscode extension",
        );
        return undefined;
      }
      logger.info("Foam extension is installed.");
      if (!foamExtension.isActive) {
        logger.info("Foam extension is not active. Activating...");
        const { foam } = await foamExtension.activate();
        logger.info("Foam extension activated.");
        logger.debug(
          "Foam extension exports:",
          Object.keys(foamExtension.exports),
          Object.keys(foam),
        );
        Context._foam = foam;
        return Context._foam;
        // this.context.subscriptions.push(this._foam);
      }
      logger.info("Foam extension is active.");
      try {
        const { foam } = foamExtension.exports;
        Context._foam = foam as Foam;
        return Context._foam;
      } catch (e) {
        logger.error("Error getting foam from foam extension exports:", e);
        vscode.window.showErrorMessage(
          "Error getting foam from foam extension exports.",
        );
        return undefined;
      }
    }
    return Context._foam;
  }
}
