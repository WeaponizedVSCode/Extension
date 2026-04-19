/**
 * Centralized command ID constants.
 * These must match the command IDs registered in package.json.
 */
export const Commands = {
  // Management
  SETUP: 'weapon.setup',
  SWITCH_HOST: 'weapon.switch_host',
  SWITCH_USER: 'weapon.switch_user',
  DUMP_HOSTS: 'weapon.dump_hosts',
  DUMP_USERS: 'weapon.dump_users',
  MCP_INSTALL: 'weapon.mcp.install',
  NOTE_CREATION: 'weapon.note.creation',

  // Internal
  RUN_COMMAND: 'weapon.run_command',
  COPY: 'weapon.copy',
  REPLACE_DOCUMENT: 'weapon.replace_document',
  DISPLAY_VIRTUAL: 'weapon.display_virtual_content',

  // Tasks
  TASK_MSFVENOM: 'weapon.task.msfvenom_creation',
  TASK_HASHCAT: 'weapon.task.hashcat_cracker',
  TASK_SCAN: 'weapon.task.scan',

  // HTTP
  HTTP_RAW_REQUEST: 'weapon.http_raw_request',
  HTTP_TO_CURL: 'weapon.http_raw_request_to_curl',

  // Features
  MAGIC_DECODER: 'weapon.magic_decoder',
  TERMINAL_LOGGER_REGISTER: 'weaponized.terminal-logger.register',
  TERMINAL_LOGGER_UNREGISTER: 'weaponized.terminal-logger.unregister',

  // External
  FOAM_SHOW_GRAPH: 'foam-vscode.show-graph',
} as const;
