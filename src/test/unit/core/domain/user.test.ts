import * as assert from "assert";
import {
  UserCredential,
  parseUserCredentialsYaml,
  dumpUserCredentials,
} from "../../../../core/domain/user";

const DEFAULT_BAD_HASH = "ffffffffffffffffffffffffffffffff";

suite("UserCredential.init", () => {
  test("initializes with all fields", () => {
    const u = new UserCredential().init({
      user: "admin",
      password: "pass123",
      nt_hash: "AABB",
      login: "corp.local",
      is_current: true,
      props: { ENV_TOOL: "mimikatz" },
    });
    assert.strictEqual(u.user, "admin");
    assert.strictEqual(u.password, "pass123");
    assert.strictEqual(u.nt_hash, "AABB");
    assert.strictEqual(u.login, "corp.local");
    assert.strictEqual(u.is_current, true);
    assert.deepStrictEqual(u.props, { ENV_TOOL: "mimikatz" });
  });

  test("defaults: empty strings, bad hash, false", () => {
    const u = new UserCredential().init({});
    assert.strictEqual(u.user, "");
    assert.strictEqual(u.password, "");
    assert.strictEqual(u.nt_hash, DEFAULT_BAD_HASH);
    assert.strictEqual(u.login, "");
    assert.strictEqual(u.is_current, false);
    assert.deepStrictEqual(u.props, {});
  });

  test("password stays default empty when not provided", () => {
    const u = new UserCredential().init({ user: "bob" });
    assert.strictEqual(u.password, "");
  });

  test("nt_hash stays default bad when not provided", () => {
    const u = new UserCredential().init({ user: "bob" });
    assert.strictEqual(u.nt_hash, DEFAULT_BAD_HASH);
  });
});

suite("UserCredential.exportEnvironmentCollects", () => {
  test("password path: exports PASS when nt_hash is default", () => {
    const u = new UserCredential().init({
      user: "admin",
      password: "secret",
      login: "corp",
      is_current: true,
    });
    const c = u.exportEnvironmentCollects();
    assert.strictEqual(c["USER_admin"], "admin");
    assert.strictEqual(c["LOGIN_admin"], "corp");
    assert.strictEqual(c["PASS_admin"], "secret");
    assert.strictEqual(c["CURRENT_USER"], "admin");
    assert.strictEqual(c["USER"], "admin");
    assert.strictEqual(c["USERNAME"], "admin");
    assert.strictEqual(c["LOGIN"], "corp");
    assert.strictEqual(c["PASS"], "secret");
    assert.strictEqual(c["PASSWORD"], "secret");
    // should NOT have NT_HASH keys
    assert.strictEqual(c["NT_HASH_admin"], undefined);
    assert.strictEqual(c["NT_HASH"], undefined);
  });

  test("hash path: exports NT_HASH when nt_hash is set", () => {
    const u = new UserCredential().init({
      user: "admin",
      nt_hash: "0123456789ABCDEF0123456789ABCDEF",
      is_current: true,
    });
    const c = u.exportEnvironmentCollects();
    assert.strictEqual(c["NT_HASH_admin"], "0123456789ABCDEF0123456789ABCDEF");
    assert.strictEqual(c["NT_HASH"], "0123456789ABCDEF0123456789ABCDEF");
    // should NOT have PASS keys
    assert.strictEqual(c["PASS_admin"], undefined);
    assert.strictEqual(c["PASS"], undefined);
  });

  test("non-current user does not export global keys", () => {
    const u = new UserCredential().init({
      user: "bob",
      password: "pw",
    });
    const c = u.exportEnvironmentCollects();
    assert.strictEqual(c["USER_bob"], "bob");
    assert.strictEqual(c["PASS_bob"], "pw");
    assert.strictEqual(c["CURRENT_USER"], undefined);
    assert.strictEqual(c["USER"], undefined);
    assert.strictEqual(c["PASS"], undefined);
  });

  test("ENV_ props are exported with prefix stripped", () => {
    const u = new UserCredential().init({
      user: "x",
      props: { ENV_MY_KEY: "val", OTHER: "no" },
    });
    const c = u.exportEnvironmentCollects();
    assert.strictEqual(c["MY_KEY"], "val");
    assert.strictEqual(c["OTHER"], undefined);
  });
});

suite("UserCredential.setAsCurrent", () => {
  test("sets is_current and returns this", () => {
    const u = new UserCredential().init({ user: "a" });
    const ret = u.setAsCurrent();
    assert.strictEqual(u.is_current, true);
    assert.strictEqual(ret, u);
  });
});

suite("UserCredential.dumpUser", () => {
  test("env format with password", () => {
    const u = new UserCredential().init({ user: "admin", password: "pw" });
    const d = u.dumpUser("env");
    assert.ok(d.startsWith("export "));
    assert.ok(d.includes("USER_admin='admin'"));
    assert.ok(d.includes("PASS_admin='pw'"));
  });

  test("impacket format with password", () => {
    const u = new UserCredential().init({
      user: "admin",
      password: "pw",
      login: "CORP",
    });
    const d = u.dumpUser("impacket");
    assert.strictEqual(d, "'CORP'/'admin':'pw'");
  });

  test("impacket format with hash", () => {
    const u = new UserCredential().init({
      user: "admin",
      nt_hash: "DEADBEEF",
      login: "CORP",
    });
    const d = u.dumpUser("impacket");
    assert.strictEqual(d, "'CORP'/'admin' -hashes ':DEADBEEF'");
  });

  test("nxc format with password, login differs from user", () => {
    const u = new UserCredential().init({
      user: "admin",
      password: "pw",
      login: "CORP",
    });
    const d = u.dumpUser("nxc");
    assert.strictEqual(d, "'CORP' -u 'admin' -p 'pw'");
  });

  test("nxc format with hash, no login", () => {
    const u = new UserCredential().init({
      user: "admin",
      nt_hash: "DEADBEEF",
    });
    const d = u.dumpUser("nxc");
    assert.strictEqual(d, "-u 'admin' -H ':DEADBEEF'");
  });

  test("yaml format produces YAML", () => {
    const u = new UserCredential().init({ user: "admin" });
    const d = u.dumpUser("yaml");
    assert.ok(d.includes("user: admin"));
  });

  test("default format is env", () => {
    const u = new UserCredential().init({ user: "admin" });
    const d = u.dumpUser();
    assert.ok(d.startsWith("export "));
  });
});

suite("parseUserCredentialsYaml", () => {
  test("parses YAML array into UserCredential objects", () => {
    const yaml = `- user: alice\n  password: pw1\n  login: corp\n- user: bob\n  nt_hash: ABCD`;
    const users = parseUserCredentialsYaml(yaml);
    assert.strictEqual(users.length, 2);
    assert.strictEqual(users[0].user, "alice");
    assert.strictEqual(users[0].password, "pw1");
    assert.strictEqual(users[1].user, "bob");
    assert.strictEqual(users[1].nt_hash, "ABCD");
  });
});

suite("dumpUserCredentials", () => {
  test("env format", () => {
    const users = [
      new UserCredential().init({ user: "a", password: "p" }),
    ];
    const out = dumpUserCredentials(users, "env");
    assert.ok(out.includes("USER_a='a'"));
  });

  test("yaml format", () => {
    const users = [new UserCredential().init({ user: "a" })];
    const out = dumpUserCredentials(users, "yaml");
    assert.ok(out.includes("user: a"));
  });

  test("table format", () => {
    const users = [new UserCredential().init({ user: "a", login: "corp" })];
    const out = dumpUserCredentials(users, "table");
    assert.ok(out.includes("User Credentials"));
    assert.ok(out.includes("corp"));
  });

  test("nxc format", () => {
    const users = [
      new UserCredential().init({ user: "admin", password: "pw" }),
    ];
    const out = dumpUserCredentials(users, "nxc");
    assert.ok(out.includes("-u 'admin'"));
  });
});
