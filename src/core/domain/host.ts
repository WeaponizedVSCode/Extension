import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { table } from "table";
import { Collects, envVarSafer } from "../env/collects";

interface innerHost {
  hostname?: string;
  ip?: string;
  alias?: string[];
  is_dc?: boolean;
  is_current?: boolean;
  is_current_dc?: boolean;
  props?: Collects; 
}

export function parseHostsYaml(content: string): Host[] {
  let hostContent = yamlParse(content) as innerHost[];
  let ret: Host[] = [];
  for (let host of hostContent) {
    let newHost = new Host().init(host);
    ret.push(newHost);
  }
  return ret;
}

export type HostDumpFormat = "env" | "hosts" | "yaml" | "table";

export class Host {
  hostname: string = "";
  ip: string = "";
  alias: string[] = [this.hostname];
  is_dc: boolean = false;
  is_current: boolean = false;
  is_current_dc: boolean = false;
  props: Collects = {};

  init(ihost: innerHost): Host {
    this.hostname = ihost.hostname ? ihost.hostname : "";
    this.ip = ihost.ip ? ihost.ip : "";
    if (ihost.alias) {
      this.alias = [...new Set(ihost.alias?.concat(this.hostname))];
    } else {
      this.alias = [this.hostname];
    }
    this.is_dc = ihost.is_dc ? ihost.is_dc : false;
    this.props = ihost.props ? ihost.props : {};
    this.is_current = ihost.is_current ? ihost.is_current : false;
    this.is_current_dc = ihost.is_current_dc ? ihost.is_current_dc : false;
    this.is_dc = ihost.is_dc ? ihost.is_dc : false;
    return this;
  }

  exportEnvironmentCollects(): Collects {
    let safename = envVarSafer(this.hostname);
    let collects = {} as Collects;
    collects[`HOST_${safename}`] = this.hostname;
    collects[`IP_${safename}`] = this.ip;
    if (this.is_dc) {
      collects[`DC_HOST_${safename}`] = this.alias[0];
      collects[`DC_IP_${safename}`] = this.ip;
    }
    if (this.is_current_dc) {
      collects[`DC_HOST`] = this.alias[0];
      collects[`DC_IP`] = this.ip;
    }
    if (this.is_current) {
      collects[`CURRENT_HOST`] = this.hostname;
      collects[`HOST`] = this.hostname;
      collects[`DOMAIN`] = this.hostname;
      collects[`RHOST`] = this.ip;
      collects[`IP`] = this.ip;
      collects[`TARGET`] = this.hostname;
    }
    for (let key in this.props) {
      if (key.startsWith("ENV_")) {
        let realkey = key.replace("ENV_", "");
        collects[`${envVarSafer(realkey)}`] = this.props[key];
      }
      // collects[`${envVarSafer(key)}`] = this.props[key];
    }
    return collects;
  }

  dump(format: HostDumpFormat): string {
    let ret = "";
    switch (format) {
      default:
      case "env":
        let collects = this.exportEnvironmentCollects();
        ret = "export ";
        for (let key in collects) {
          ret += `${key}='${collects[key]}' `;
        }
        ret = ret.trim();
        break;
      case "hosts":
        ret = `${this.ip}\t${this.alias.join(" ")}`;
        break;
      case "yaml":
        ret = yamlStringify(this);
        break;
    }
    return ret;
  }

  setAsCurrent(): Host {
    this.is_current = true;
    return this;
  }

  setAsCurrentDC(): Host {
    this.is_current_dc = true;
    return this;
  }
}

export function dumpHosts(hosts: Host[], format: HostDumpFormat): string {
  let ret = "";
  if (format === "yaml") {
    ret = yamlStringify(hosts);
    return ret;
  }
  if (format === "table") {
    let header = [
      "IP Address",
      "Hostname",
      "Aliases",
      "Is DC",
      "Is Current",
      "Is Current DC",
      "Properties",
    ];
    let data: string[][] = [header];
    for (let host of hosts) {
      let props_str = "";
      for (let key in host.props) {
        props_str += `${key}=${host.props[key]}\n`;
      }
      data.push([
        host.ip,
        host.hostname,
        host.alias.join("\n"),
        host.is_dc ? "Yes" : "No",
        host.is_current ? "Yes" : "No",
        host.is_current_dc ? "Yes" : "No",
        props_str,
      ]);
    }
    let t: string = table(data, {
      header: {
        content: "Host Information",
      },
      columns: {
        0: { alignment: "left" }, // IP Address
        1: { alignment: "left" }, // Hostname
        2: { alignment: "center" }, // Aliases
        3: { alignment: "center" }, // Is DC
        4: { alignment: "center" }, // Is Current
        5: { alignment: "center" }, // Is Current DC
        6: { alignment: "left" },   // Properties
      },
    });
    return t;
  }
  for (let h of hosts) {
    var host = new Host().init(h);
    ret += `${host.dump(format)}\n`;
  }
  return ret;
}

function test() {
  let hosta = new Host();
  hosta.init({
    hostname: "github.com",
  });
  hosta.setAsCurrent();
  hosta.setAsCurrentDC();
  console.log(hosta.alias);
  console.log(hosta.dump("env"));
  let content = `
- hostname: github.com
  ip: 10.10.10.1
  aliases:
  - dc01.github.com
  - dc02.github.com
  is_dc: true
  is_current: true
  is_current_dc: true
- hostname: data.github.com
  ip: 10.10.10.2
  aliases:
    - data1.github.com
    - data2.github.com
    - test-data.github.com
  `;
  let hosts = parseHostsYaml(content);
  console.log(dumpHosts(hosts, "env"));
}

//(() => { test(); })();
