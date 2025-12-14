import * as vscode from "vscode";
import {
  Host,
  parseHostsYaml,
  parseUserCredentialsYaml,
  UserCredential,
  Collects,
  mergeCollects,
} from "../../../core";
import { logger } from "../../../platform/vscode/logger";
import { Context } from "../../../platform/vscode/context";
import { defaultCollects } from "../../../platform/vscode/defaultCollects";
import { extractYamlBlocksByIdentity } from "../../../core/markdown";

export function getCodeblock(content: string, identity: string): string[] {
  return extractYamlBlocksByIdentity(content, identity).map((b) => b.content);
}

function uniqueHosts(old_host: Host[]): Host[] {
  let uniqmap = new Map<string, number>();
  let newHost: Host[] = [];
  for (let h of old_host) {
    if (uniqmap.has(h.hostname)) {
      continue;
    }
    newHost.push(h);
    uniqmap.set(h.hostname, 1);
  }
  return newHost;
}

function uniqueUsers(old_user: UserCredential[]): UserCredential[] {
  let uniqmap = new Map<string, number>();
  let newUser: UserCredential[] = [];
  for (let u of old_user) {
    if (uniqmap.has(`${u.login}/${u.user}`)) {
      continue;
    }
    newUser.push(u);
    uniqmap.set(`${u.login}/${u.user}`, 1);
  }
  return newUser;
}

export function mergeUserCredFromFile(
  content: string,
  old_user_list: UserCredential[]
): UserCredential[] {
  const blocks = extractYamlBlocksByIdentity(content, "credentials");
  for (const block of blocks) {
    try {
      const users: UserCredential[] = parseUserCredentialsYaml(block.content);
      old_user_list.push(...users);
    } catch (e) {
      logger.error(`parse failed, content: ${block.content}`);
    }
  }
  return uniqueUsers(old_user_list.reverse()); // let new changes on top
}

export function mergeHostFromFile(
  content: string,
  old_host_list: Host[]
): Host[] {
  const blocks = extractYamlBlocksByIdentity(content, "host");
  for (const block of blocks) {
    try {
      const hosts: Host[] = parseHostsYaml(block.content);
      old_host_list.push(...hosts);
    } catch (e) {
      logger.error(`parse failed, content: ${block.content}`);
    }
  }
  return uniqueHosts(old_host_list.reverse());
}

export async function ProcessWorkspaceStateToEnvironmentCollects(
  workspace: vscode.WorkspaceFolder
) {
  let collection = Context.context.environmentVariableCollection.getScoped({
    workspaceFolder: workspace,
  });
  logger.info(`Processing workspaceState on workspace: ${workspace.name}`);
  collection.clear();
  logger.trace(`Cleared environment variable collection for workspace: ${workspace.name}`);
  defaultCollects["PROJECT_FOLDER"] = workspace.uri.fsPath;

  let ul: Collects = {};
  let old_user_list = Context.UserState;
  if (old_user_list) {
    for (let user of old_user_list) {
      var uc = user.exportEnvironmentCollects();
      ul = mergeCollects(ul, uc);
    }
  }

  let hl: Collects = {};
  let old_host_list = Context.HostState;
  if (old_host_list) {
    for (let host of old_host_list) {
      hl = mergeCollects(hl, host.exportEnvironmentCollects());
    }
  }

  let collects = mergeCollects(ul, hl, defaultCollects);
  for (let key in collects) {
    logger.trace(
      `Setting environment variable into collections: ${key} => ${collects[key]}`
    );
    collection.replace(key, collects[key]);
  }
}

export async function ProcessMarkdownFileToWorkspaceState(file: vscode.Uri) {
  const content = await vscode.workspace.fs.readFile(file);

  let old_user_list = Context.UserState;
  if (!old_user_list) {
    Context.UserState = [];
  } else {
    old_user_list = mergeUserCredFromFile(content.toString(), old_user_list);
    logger.trace(`Merged user credentials from file: ${file.fsPath} `);
    Context.UserState = old_user_list;
  }

  let old_host_list = Context.HostState;
  if (!old_host_list) {
    Context.HostState = [];
  } else {
    old_host_list = mergeHostFromFile(content.toString(), old_host_list);
    logger.trace(`Merged hosts from file: ${file.fsPath} `);
    Context.HostState = old_host_list;
  }
}
