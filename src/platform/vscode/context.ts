import { ExtensionContext } from "vscode";
import { UserCredential, Host } from "../../core";
import type { Foam } from "../../core";
import * as vscode from "vscode";
import { logger } from "../../platform/vscode/logger";

export class Context {
  private static _extContext: ExtensionContext;
  private static _foam: Foam;
  private static _hostCache: Host[] | undefined;
  private static _hostDirty = true;
  private static _userCache: UserCredential[] | undefined;
  private static _userDirty = true;

  public static get context(): ExtensionContext {
    return this._extContext;
  }

  public static set context(ec: ExtensionContext) {
    this._extContext = ec;
  }

  public static get UserState(): UserCredential[] | undefined {
    if (this._userDirty) {
      const users = this.context.workspaceState.get<UserCredential[]>("users");
      this._userCache = users?.map((u) => new UserCredential().init(u));
      this._userDirty = false;
    }
    return this._userCache;
  }

  public static set UserState(us: UserCredential[]) {
    this.context.workspaceState.update("users", us);
    this._userDirty = true;
  }

  public static get HostState(): Host[] | undefined {
    if (this._hostDirty) {
      const hosts = this.context.workspaceState.get<Host[]>("hosts");
      this._hostCache = hosts?.map((h) => new Host().init(h));
      this._hostDirty = false;
    }
    return this._hostCache;
  }

  public static set HostState(hs: Host[]) {
    this.context.workspaceState.update("hosts", hs);
    this._hostDirty = true;
  }

  public static async Foam(): Promise<Foam | undefined> {
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
      try {
        if (!foamExtension.isActive) {
          logger.info("Foam extension is not active. Activating...");
          await foamExtension.activate();
          logger.info("Foam extension activated.");
        }
        const { foam } = foamExtension.exports;
        Context._foam = foam as Foam;
      } catch (e) {
        logger.error("Failed to get Foam:", e);
        return undefined;
      }
    }
    return Context._foam;
  }
}
