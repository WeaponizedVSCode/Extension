import * as assert from "assert";
import { Host, parseHostsYaml, dumpHosts } from "../../../../core/domain/host";

suite("Host.init", () => {
  test("initializes with all fields", () => {
    const h = new Host().init({
      hostname: "dc01.corp.local",
      ip: "10.10.10.100",
      alias: ["dc01", "dc01.corp.local"],
      is_dc: true,
      is_current: true,
      is_current_dc: true,
      props: { ENV_TOOL: "nmap" },
    });
    assert.strictEqual(h.hostname, "dc01.corp.local");
    assert.strictEqual(h.ip, "10.10.10.100");
    assert.strictEqual(h.is_dc, true);
    assert.strictEqual(h.is_current, true);
    assert.strictEqual(h.is_current_dc, true);
    assert.ok(h.alias.includes("dc01"));
    assert.ok(h.alias.includes("dc01.corp.local"));
  });

  test("defaults to empty strings and false booleans", () => {
    const h = new Host().init({});
    assert.strictEqual(h.hostname, "");
    assert.strictEqual(h.ip, "");
    assert.strictEqual(h.is_dc, false);
    assert.strictEqual(h.is_current, false);
    assert.strictEqual(h.is_current_dc, false);
    assert.deepStrictEqual(h.props, {});
  });

  test("alias includes hostname when alias array is provided", () => {
    const h = new Host().init({
      hostname: "web01",
      alias: ["web"],
    });
    assert.ok(h.alias.includes("web01"));
    assert.ok(h.alias.includes("web"));
  });

  test("alias defaults to [hostname] when no alias provided", () => {
    const h = new Host().init({ hostname: "srv01" });
    assert.deepStrictEqual(h.alias, ["srv01"]);
  });

  test("alias deduplicates when hostname already in alias", () => {
    const h = new Host().init({
      hostname: "srv01",
      alias: ["srv01", "srv01"],
    });
    // Set deduplication
    const count = h.alias.filter((a) => a === "srv01").length;
    assert.strictEqual(count, 1);
  });
});

suite("Host.exportEnvironmentCollects", () => {
  test("basic host exports HOST_ and IP_ keys", () => {
    const h = new Host().init({
      hostname: "web01.corp.local",
      ip: "10.0.0.1",
    });
    const c = h.exportEnvironmentCollects();
    assert.strictEqual(c["HOST_web01_corp_local"], "web01.corp.local");
    assert.strictEqual(c["IP_web01_corp_local"], "10.0.0.1");
  });

  test("DC host exports DC_HOST_ and DC_IP_ keys", () => {
    const h = new Host().init({
      hostname: "dc01.corp.local",
      ip: "10.0.0.2",
      is_dc: true,
    });
    const c = h.exportEnvironmentCollects();
    assert.strictEqual(c["DC_HOST_dc01_corp_local"], "dc01.corp.local");
    assert.strictEqual(c["DC_IP_dc01_corp_local"], "10.0.0.2");
  });

  test("current DC exports DC_HOST and DC_IP (global)", () => {
    const h = new Host().init({
      hostname: "dc01.corp.local",
      ip: "10.0.0.2",
      is_current_dc: true,
    });
    const c = h.exportEnvironmentCollects();
    assert.strictEqual(c["DC_HOST"], "dc01.corp.local");
    assert.strictEqual(c["DC_IP"], "10.0.0.2");
  });

  test("current host exports TARGET=hostname (not ip)", () => {
    const h = new Host().init({
      hostname: "dc01.corp.local",
      ip: "10.10.10.100",
      is_current: true,
    });
    const c = h.exportEnvironmentCollects();
    assert.strictEqual(c["TARGET"], "dc01.corp.local");
    assert.strictEqual(c["RHOST"], "10.10.10.100");
    assert.strictEqual(c["HOST"], "dc01.corp.local");
    assert.strictEqual(c["DOMAIN"], "dc01.corp.local");
    assert.strictEqual(c["CURRENT_HOST"], "dc01.corp.local");
    assert.strictEqual(c["IP"], "10.10.10.100");
  });

  test("props with ENV_ prefix are exported with prefix stripped", () => {
    const h = new Host().init({
      hostname: "srv",
      props: { ENV_MY_VAR: "val", OTHER: "ignored" },
    });
    const c = h.exportEnvironmentCollects();
    assert.strictEqual(c["MY_VAR"], "val");
    assert.strictEqual(c["OTHER"], undefined);
  });
});

suite("Host.setAsCurrent / setAsCurrentDC", () => {
  test("setAsCurrent sets is_current and returns this", () => {
    const h = new Host().init({ hostname: "a" });
    const ret = h.setAsCurrent();
    assert.strictEqual(h.is_current, true);
    assert.strictEqual(ret, h);
  });

  test("setAsCurrentDC sets is_current_dc and returns this", () => {
    const h = new Host().init({ hostname: "a" });
    const ret = h.setAsCurrentDC();
    assert.strictEqual(h.is_current_dc, true);
    assert.strictEqual(ret, h);
  });
});

suite("Host.dump", () => {
  test("env format produces export line", () => {
    const h = new Host().init({ hostname: "srv", ip: "1.2.3.4" });
    const d = h.dump("env");
    assert.ok(d.startsWith("export "));
    assert.ok(d.includes("HOST_srv='srv'"));
    assert.ok(d.includes("IP_srv='1.2.3.4'"));
  });

  test("hosts format produces IP tab aliases", () => {
    const h = new Host().init({ hostname: "srv", ip: "1.2.3.4", alias: ["web"] });
    const d = h.dump("hosts");
    assert.strictEqual(d, "1.2.3.4\tweb srv");
  });

  test("yaml format produces YAML string", () => {
    const h = new Host().init({ hostname: "srv" });
    const d = h.dump("yaml");
    assert.ok(d.includes("hostname: srv"));
  });
});

suite("parseHostsYaml", () => {
  test("parses YAML array into Host objects", () => {
    const yaml = `- hostname: web01\n  ip: 10.0.0.1\n- hostname: web02\n  ip: 10.0.0.2`;
    const hosts = parseHostsYaml(yaml);
    assert.strictEqual(hosts.length, 2);
    assert.strictEqual(hosts[0].hostname, "web01");
    assert.strictEqual(hosts[1].ip, "10.0.0.2");
  });
});

suite("dumpHosts", () => {
  test("env format dumps each host on a line", () => {
    const hosts = [
      new Host().init({ hostname: "a", ip: "1.1.1.1" }),
      new Host().init({ hostname: "b", ip: "2.2.2.2" }),
    ];
    const out = dumpHosts(hosts, "env");
    assert.ok(out.includes("HOST_a='a'"));
    assert.ok(out.includes("HOST_b='b'"));
  });

  test("hosts format dumps each host", () => {
    const hosts = [new Host().init({ hostname: "a", ip: "1.1.1.1" })];
    const out = dumpHosts(hosts, "hosts");
    assert.ok(out.includes("1.1.1.1\ta"));
  });

  test("yaml format returns YAML string", () => {
    const hosts = [new Host().init({ hostname: "a" })];
    const out = dumpHosts(hosts, "yaml");
    assert.ok(out.includes("hostname: a"));
  });

  test("table format returns formatted table", () => {
    const hosts = [new Host().init({ hostname: "a", ip: "1.1.1.1" })];
    const out = dumpHosts(hosts, "table");
    assert.ok(out.includes("Host Information"));
    assert.ok(out.includes("1.1.1.1"));
  });
});
