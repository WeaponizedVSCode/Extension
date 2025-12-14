import { ExtensionContext } from "vscode";
import { UserCredential, Host } from "../../core";

export class Context {
  private static _extContext: ExtensionContext;

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
}
